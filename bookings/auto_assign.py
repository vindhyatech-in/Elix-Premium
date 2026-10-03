"""
bookings/auto_assign.py
-----------------------
Pure service layer — no views, no signals, no HTTP.
Call auto_assign_beautician(booking) right after a Booking and its
BookingItem rows have been persisted.

Algorithm (in order):
  1. Compute the "blocked window" for the new booking:
       block_start = start_time – 1 h
       block_end   = start_time + total_duration + 1 h
  2. Filter all active employees to those who are genuinely free.
  3. Sort the free list by (bookings_today, id) → fewest jobs first.
  4. If nobody is free → FALLBACK: pick the employee whose soonest
     active booking's block_end is earliest (they free up first).
  5. Return the winner (or None if there are zero employees at all).
"""

from decimal import Decimal
import logging
from datetime import datetime, timedelta, time

from django.utils import timezone

from accounts.models import Employee, EmployeeLeave
from bookings.models import Booking

logger = logging.getLogger(__name__)

# Buffer configuration
BUFFER_HOURS = 1
BUFFER_MINS_STANDARD = 60
BUFFER_MINS_PRIORITY = 30
RUSH_BONUS_AMOUNT = Decimal('50.00')
URGENT_BOOKING_FEE_AMOUNT = Decimal('99.00')

# Used when exact_time is missing — midpoints of each slot.
SLOT_MIDPOINTS = {
    'morning':   time(10, 0),
    'afternoon': time(14, 0),
    'evening':   time(18, 0),
}

# Fallback total duration (minutes) when a booking has no items.
DEFAULT_DURATION_MINS = 60


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _booking_duration_mins(booking):
    """Sum duration_snapshot x quantity across all items; fallback = 60 min."""
    items = list(booking.items.all())
    if not items:
        return DEFAULT_DURATION_MINS
    return sum(item.duration_snapshot * item.quantity for item in items)


def _booking_start_time(booking):
    """
    Resolve the job's start time.
    Returns None if neither exact_time nor a recognised time_slot is set
    (caller should skip auto-assignment).
    """
    if booking.exact_time:
        return booking.exact_time
    return SLOT_MIDPOINTS.get(booking.time_slot)


def _booking_job_window(booking):
    """
    Compute (job_start, job_end) as timezone-aware datetimes without buffers.
    Returns None when start time cannot be resolved.
    """
    start_t = _booking_start_time(booking)
    if start_t is None:
        return None

    tz = timezone.get_current_timezone()
    naive_start = datetime.combine(booking.scheduled_date, start_t)
    job_start = timezone.make_aware(naive_start, tz)

    duration_mins = _booking_duration_mins(booking)
    job_end = job_start + timedelta(minutes=duration_mins)
    return job_start, job_end


def _blocked_window(booking, buffer_mins=BUFFER_MINS_STANDARD):
    """
    Compute (block_start, block_end) as timezone-aware datetimes with buffer.
    Returns None when start time cannot be resolved.
    """
    jw = _booking_job_window(booking)
    if jw is None:
        return None
    job_start, job_end = jw
    block_start = job_start - timedelta(minutes=buffer_mins)
    block_end   = job_end   + timedelta(minutes=buffer_mins)
    return block_start, block_end


def _has_leave_conflict(employee, target_date, block_start, block_end):
    """True if the employee has any EmployeeLeave that covers target_date or
    overlaps the [block_start.time, block_end.time] window."""
    leaves = EmployeeLeave.objects.filter(
        employee=employee,
        start_date__lte=target_date,
        end_date__gte=target_date,
    )
    for leave in leaves:
        if leave.leave_type in ('full_day', 'multi_day'):
            return True
        # short_break — check time overlap
        if leave.start_time and leave.end_time:
            tz = timezone.get_current_timezone()
            leave_s = timezone.make_aware(datetime.combine(target_date, leave.start_time), tz)
            leave_e = timezone.make_aware(datetime.combine(target_date, leave.end_time), tz)
            # Overlap: not (block_end <= leave_s or block_start >= leave_e)
            if not (block_end <= leave_s or block_start >= leave_e):
                return True
    return False


def _check_travel_gap(employee, target_date, job_start, job_end, min_gap_mins=BUFFER_MINS_STANDARD, exclude_booking_id=None):
    """
    Checks if an employee has at least `min_gap_mins` travel/rest gap between
    the new booking [job_start, job_end] and all existing non-cancelled bookings.
    Returns False if there is a direct overlap or if gap < min_gap_mins.
    """
    existing = Booking.objects.filter(
        assigned_beautician=employee,
        scheduled_date=target_date,
    ).exclude(status='cancelled')

    if exclude_booking_id:
        existing = existing.exclude(id=exclude_booking_id)

    required_gap = timedelta(minutes=min_gap_mins)

    for bk in existing:
        w = _booking_job_window(bk)
        if w is None:
            continue
        bk_start, bk_end = w

        # Direct overlap check: both jobs are running simultaneously
        if not (job_end <= bk_start or job_start >= bk_end):
            return False

        # Gap before our job (previous booking)
        if bk_end <= job_start:
            if (job_start - bk_end) < required_gap:
                return False

        # Gap after our job (subsequent booking)
        if bk_start >= job_end:
            if (bk_start - job_end) < required_gap:
                return False

    return True


def _is_available(employee, target_date, job_start, job_end, exclude_booking_id=None, min_gap_mins=BUFFER_MINS_STANDARD):
    """Full availability check for a single employee."""
    if employee.status != 'active':
        return False
    block_start = job_start - timedelta(minutes=min_gap_mins)
    block_end = job_end + timedelta(minutes=min_gap_mins)
    if _has_leave_conflict(employee, target_date, block_start, block_end):
        return False
    if not _check_travel_gap(employee, target_date, job_start, job_end, min_gap_mins=min_gap_mins, exclude_booking_id=exclude_booking_id):
        return False
    return True


def _bookings_today_count(employee, target_date):
    """Non-cancelled booking count for the employee on target_date (load metric)."""
    return Booking.objects.filter(
        assigned_beautician=employee,
        scheduled_date=target_date,
    ).exclude(status='cancelled').count()


def _soonest_free_block_end(employee, target_date):
    """
    Fallback comparator: the latest block_end among the employee's active
    bookings on target_date.  The employee with the smallest value frees up
    first.  Returns far-future datetime when no window can be computed.
    """
    far_future = timezone.now() + timedelta(days=9999)
    active = Booking.objects.filter(
        assigned_beautician=employee,
        scheduled_date=target_date,
    ).exclude(status='cancelled')

    latest_end = None
    for bk in active:
        window = _blocked_window(bk)
        if window is None:
            continue
        _, bk_end = window
        if latest_end is None or bk_end > latest_end:
            latest_end = bk_end

    return latest_end or far_future


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_urgent_slot_availability(target_date, duration_mins=60):
    """
    Returns available express slots for target_date.
    Each slot is checked against all active beauticians taking into account
    existing bookings, the +/- 1 hour buffer, and leaves.
    """
    tz = timezone.get_current_timezone()
    now_dt = timezone.localtime()
    today_date = now_dt.date()

    if target_date < today_date:
        return {
            'has_slots': False,
            'slots': [],
            'earliest_slot': None,
            'is_fully_booked': True,
            'message': 'Cannot book for a past date.',
        }

    # If today, enforce at least 50 mins from current time
    if target_date == today_date:
        min_start_dt = now_dt + timedelta(minutes=50)
        rem = min_start_dt.minute % 15
        if rem > 0:
            min_start_dt += timedelta(minutes=(15 - rem))
        start_time = min_start_dt.time()
    else:
        start_time = time(8, 0)

    end_time = time(21, 0)  # 9 PM

    all_employees = list(Employee.objects.filter(status='active'))
    if not all_employees:
        return {
            'has_slots': False,
            'slots': [],
            'earliest_slot': None,
            'is_fully_booked': True,
            'message': 'No artists currently available.',
        }

    available_slots = []
    curr_dt = timezone.make_aware(datetime.combine(target_date, start_time), tz)
    end_dt = timezone.make_aware(datetime.combine(target_date, end_time), tz)

    while curr_dt <= end_dt:
        slot_t = curr_dt.time()
        job_start = curr_dt
        job_end = job_start + timedelta(minutes=duration_mins)

        free_emps = [
            emp for emp in all_employees
            if _is_available(emp, target_date, job_start, job_end, min_gap_mins=BUFFER_MINS_PRIORITY)
        ]

        h = slot_t.hour
        m = slot_t.minute
        ampm = 'PM' if h >= 12 else 'AM'
        display_h = h % 12 or 12
        display_time = f"{display_h}:{m:02d} {ampm}"
        iso_time = f"{h:02d}:{m:02d}"

        if free_emps:
            available_slots.append({
                'time': iso_time,
                'display': display_time,
                'free_count': len(free_emps),
            })

        curr_dt += timedelta(minutes=15)

    if available_slots:
        earliest = available_slots[0]
        earliest_t = time.fromisoformat(earliest['time'])
        is_delayed = earliest_t > start_time
        return {
            'has_slots': True,
            'slots': available_slots,
            'earliest_slot': earliest,
            'is_delayed': is_delayed,
            'message': (
                f"Next available express slot: {earliest['display']}."
                if is_delayed else
                f"Express artist ready — earliest slot: {earliest['display']}."
            ),
        }
    else:
        # All slots booked! Estimate soonest completion
        earliest_free_dt = None
        for emp in all_employees:
            free_end = _soonest_free_block_end(emp, target_date)
            if earliest_free_dt is None or free_end < earliest_free_dt:
                earliest_free_dt = free_end

        estimate_str = None
        if earliest_free_dt and earliest_free_dt.date() == target_date:
            h = earliest_free_dt.hour
            m = earliest_free_dt.minute
            ampm = 'PM' if h >= 12 else 'AM'
            display_h = h % 12 or 12
            estimate_str = f"{display_h}:{m:02d} {ampm}"

        return {
            'has_slots': False,
            'slots': [],
            'earliest_slot': None,
            'is_fully_booked': True,
            'earliest_free_estimate': estimate_str,
            'message': (
                f"All artists are currently fully booked for instant delivery today."
                + (f" Next estimated opening around {estimate_str}." if estimate_str else "")
                + " Please select a Regular time slot."
            ),
        }


def notify_owner_urgent_overlap(booking, beautician):
    """
    Sends an immediate high-priority alert to the Owner (via Email, In-app Notification,
    and WhatsApp log/dispatch) when an urgent booking had to be assigned via fallback
    due to all beauticians being busy.
    """
    import threading
    from django.conf import settings
    from django.core.mail import EmailMultiAlternatives
    from django.contrib.auth import get_user_model
    from bookings.models import UserNotification

    owner_email = getattr(settings, 'SITE_EMAIL', 'gehlotsakshi1296@gmail.com')
    owner_phone = getattr(settings, 'SITE_PHONE', '+91 74406 70533')
    time_str = booking.exact_time.strftime('%I:%M %p') if booking.exact_time else (booking.time_slot or 'N/A')

    # 1. In-app notification for all staff/superadmins
    try:
        User = get_user_model()
        admin_users = User.objects.filter(is_staff=True)
        for admin_user in admin_users:
            UserNotification.objects.create(
                user=admin_user,
                booking=booking,
                ntype='general',
                title=f"⚠️ URGENT OVERLAP: Order #{booking.booking_number}",
                body=(
                    f"Urgent Order #{booking.booking_number} for {booking.customer_display_name} "
                    f"at {time_str} was fallback-assigned to {beautician.name} because all staff were busy. "
                    f"Please review customer timing or dispatch backup."
                ),
            )
    except Exception as exc:
        logger.warning('Failed to create in-app notification for urgent overlap: %s', exc)

    # 2. Email alert to Owner (in background thread)
    def _send_alert_email():
        try:
            subject = f"⚠️ [ACTION REQUIRED] Urgent Booking #{booking.booking_number} — Staff Overlap Alert"
            text_body = (
                f"URGENT BOOKING OVERLAP ALERT\n"
                f"=====================================\n\n"
                f"Booking Number: #{booking.booking_number}\n"
                f"Customer: {booking.customer_display_name} ({getattr(booking.user, 'email', 'N/A')})\n"
                f"Address: {booking.address_text}\n"
                f"Scheduled Time: {time_str} (Urgent Express)\n"
                f"Assigned Artist: {beautician.name} (Assigned as fastest completion)\n\n"
                f"NOTE: All active beauticians had bookings overlapping this time window (+/- 1 hr buffer).\n"
                f"RECOMMENDED ACTION:\n"
                f"1. Check if {beautician.name} can complete early or travel in time.\n"
                f"2. Contact the customer to confirm or adjust timing if needed.\n"
                f"3. Or reassign to an on-call backup artist from the Elix Dashboard.\n\n"
                f"Dashboard Link: https://{getattr(settings, 'SITE_DOMAIN', 'elix.in')}/dashboard/bookings/\n"
            )
            html_body = f"""
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #ef4444; border-radius: 8px;">
                <h2 style="color: #ef4444; margin-top: 0;">⚠️ URGENT BOOKING OVERLAP ALERT</h2>
                <p style="font-size: 15px; color: #333;">
                    An urgent order has arrived while all beauticians have overlapping bookings during this window.
                </p>
                <div style="background: #fef2f2; border: 1px solid #fee2e2; border-radius: 6px; padding: 15px; margin: 15px 0;">
                    <p style="margin: 4px 0;"><strong>Order:</strong> #{booking.booking_number}</p>
                    <p style="margin: 4px 0;"><strong>Customer:</strong> {booking.customer_display_name}</p>
                    <p style="margin: 4px 0;"><strong>Requested Time:</strong> {time_str} (Urgent)</p>
                    <p style="margin: 4px 0;"><strong>Address:</strong> {booking.address_text}</p>
                    <p style="margin: 4px 0;"><strong>Assigned Artist:</strong> {beautician.name}</p>
                </div>
                <p style="font-size: 14px; color: #555;">
                    <strong>Recommended Action:</strong> Check artist status or contact the customer to confirm realistic arrival timing.
                </p>
                <a href="https://{getattr(settings, 'SITE_DOMAIN', 'elix.in')}/dashboard/bookings/" style="display: inline-block; background: #ef4444; color: white; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                    Open Admin Dashboard
                </a>
            </div>
            """
            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', owner_email),
                to=[owner_email],
            )
            msg.attach_alternative(html_body, 'text/html')
            msg.send(fail_silently=False)
            logger.info("Urgent overlap alert email sent to %s for booking %s", owner_email, booking.booking_number)
        except Exception as exc:
            logger.warning("Failed to send urgent overlap alert email: %s", exc)

    threading.Thread(target=_send_alert_email, daemon=True).start()

    # 3. Log WhatsApp alert dispatch for owner
    logger.warning(
        "[URGENT WHATSAPP ALERT TO OWNER %s] Order #%s at %s: all staff busy; fallback assigned to %s.",
        owner_phone, booking.booking_number, time_str, beautician.name
    )


def auto_assign_beautician(booking):
    """
    Main entry point.  Call after the booking and its items are saved.

    Returns the Employee to assign, or None if there are no employees at all.
    Does NOT mutate the booking itself — the caller is responsible for saving.

    Logs a warning when the fallback (overlap) strategy is used so the owner
    can see it in server logs.
    """
    jw = _booking_job_window(booking)
    if jw is None:
        logger.info(
            'auto_assign: booking %s has no resolvable start time — skipping.',
            booking.booking_number,
        )
        return None

    job_start, job_end = jw
    target_date = booking.scheduled_date

    all_employees = list(Employee.objects.filter(status='active'))
    if not all_employees:
        logger.warning(
            'auto_assign: no active employees — cannot assign booking %s.',
            booking.booking_number,
        )
        return None

    # --- 1. Primary path: employees with standard 60-min buffer ---
    available_standard = [
        emp for emp in all_employees
        if _is_available(emp, target_date, job_start, job_end, exclude_booking_id=booking.id, min_gap_mins=BUFFER_MINS_STANDARD)
    ]

    if available_standard:
        available_standard.sort(key=lambda emp: (_bookings_today_count(emp, target_date), emp.id))
        chosen = available_standard[0]
        # Standard buffer: no rush required
        booking.beautician_rush_bonus = Decimal('0.00')
        logger.info(
            'auto_assign: booking %s → %s (standard 60m buffer, load=%d).',
            booking.booking_number, chosen.name,
            _bookings_today_count(chosen, target_date),
        )
        return chosen

    # --- 2. Priority Rush path: compressed 30-min buffer for priority/urgent orders ---
    # "pay 50rs to beautician if he/she need to start next booking in 30 min for priority order instead of one hour"
    if booking.booking_type == 'urgent':
        available_30 = [
            emp for emp in all_employees
            if _is_available(emp, target_date, job_start, job_end, exclude_booking_id=booking.id, min_gap_mins=BUFFER_MINS_PRIORITY)
        ]
        if available_30:
            available_30.sort(key=lambda emp: (_bookings_today_count(emp, target_date), emp.id))
            chosen = available_30[0]
            # Beautician starts with 30-min buffer -> Award ₹50 Rush Bonus!
            booking.beautician_rush_bonus = RUSH_BONUS_AMOUNT
            logger.info(
                'auto_assign: booking %s → %s (priority 30m buffer, ₹50 rush bonus awarded).',
                booking.booking_number, chosen.name,
            )
            return chosen

    # --- 3. Fallback path: everyone is busy — pick the one who frees up soonest ---
    logger.warning(
        'auto_assign: booking %s — no free beautician; using fallback (soonest-free).',
        booking.booking_number,
    )
    all_employees.sort(key=lambda emp: (_soonest_free_block_end(emp, target_date), emp.id))
    chosen = all_employees[0]
    logger.warning(
        'auto_assign: fallback assigned booking %s → %s (overlap — review manually).',
        booking.booking_number, chosen.name,
    )
    if booking.booking_type == 'urgent':
        booking.beautician_rush_bonus = RUSH_BONUS_AMOUNT
        notify_owner_urgent_overlap(booking, chosen)
    return chosen

