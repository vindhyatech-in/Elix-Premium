import calendar as calendar_module
import secrets
from datetime import timedelta

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Sum
from django.shortcuts import redirect, render
from django.utils import timezone
from django.utils.dateparse import parse_date

from core.utils import get_object_or_404_safe, looks_like_phone, validate_image_upload

# How long a generated start OTP stays valid — long enough that a slow
# customer isn't locked out, short enough that an old code lying around
# is useless later. regenerate_otp exists for anything past this.
OTP_VALIDITY = timedelta(minutes=20)

# A 6-digit code with no attempt cap is brute-forceable at a high enough
# request rate within its 20-minute validity window — locks out (forcing
# a fresh code via "Get New Code") after this many wrong guesses.
OTP_MAX_ATTEMPTS = 5


def _generate_otp():
    return ''.join(secrets.choice('0123456789') for _ in range(6))

from accounts.models import Employee, EmployeeLeave
from bookings.models import Booking

MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]


def _build_month_calendar(employee, year, month, today_date):
    """
    A Sunday-first month grid (matching booking_drawer.js's own calendar —
    same `S M T W T F S` convention across the whole app) for the Today
    tab's "at a glance" widget. Each day gets: how many of the employee's
    non-cancelled bookings fall on it (`job_count`), whether it's inside an
    EmployeeLeave range (`is_leave`), and `has_conflict` when both are
    true — a job assigned during declared leave, worth flagging since it
    means the owner assigned something after (or without seeing) the leave.
    """
    cal = calendar_module.Calendar(firstweekday=6)  # 6 = Sunday
    month_dates = list(cal.itermonthdates(year, month))
    range_start, range_end = month_dates[0], month_dates[-1]

    job_counts = {}
    if employee:
        rows = (
            Booking.objects.filter(
                assigned_beautician=employee, scheduled_date__range=(range_start, range_end),
            )
            .exclude(status='cancelled')
            .values('scheduled_date')
            .annotate(count=Count('id'))
        )
        job_counts = {row['scheduled_date']: row['count'] for row in rows}

    leave_dates = set()
    if employee:
        leaves = employee.leaves.filter(start_date__lte=range_end, end_date__gte=range_start)
        for leave in leaves:
            d = max(leave.start_date, range_start)
            last = min(leave.end_date, range_end)
            while d <= last:
                leave_dates.add(d)
                d += timedelta(days=1)

    weeks, week = [], []
    for d in month_dates:
        job_count = job_counts.get(d, 0)
        is_leave = d in leave_dates
        week.append({
            'date': d,
            'day': d.day,
            'in_month': d.month == month,
            'is_today': d == today_date,
            'is_weekend': d.weekday() in (5, 6),
            'job_count': job_count,
            'is_leave': is_leave,
            'has_conflict': job_count > 0 and is_leave,
        })
        if len(week) == 7:
            weeks.append(week)
            week = []
    return weeks


@login_required(login_url='account_login')
def employee_dashboard(request):
    """
    Employee / Beautician Dashboard: Mobile-first control panel for assigned jobs,
    schedule navigation, order status updates, payment collection, and duty status toggle.
    """
    user = request.user

    # Identify employee profile — ONLY via the real user<->Employee link
    # established by an admin (_create_employee_login/generate_login).
    # A previous fallback matched by `user.email == Employee.email`
    # instead — Employee.email is just admin-entered contact info, and
    # a user's own account email is self-service editable, so anyone who
    # set their account email to a real employee's contact email got
    # treated as that employee (full access to their bookings/customer
    # PII, mark_paid, arrival-photo/OTP verification). Removed — no
    # legitimate employee needs this, since every employee with a login
    # already has `employee_profile` set directly.
    employee = user.employee_profile if hasattr(user, 'employee_profile') else None

    if not employee and user.is_staff:
        # Staff/Owner previewing the employee view
        emp_id = request.GET.get('emp_id')
        if emp_id and emp_id.isdigit():
            employee = Employee.objects.filter(id=emp_id).first()
        if not employee:
            employee = Employee.objects.first()

    if not employee and not user.is_staff:
        messages.error(request, 'You do not have an assigned Beautician profile.')
        return redirect('services_booking')

    today_date = timezone.now().date()

    # Handle POST Actions
    if request.method == 'POST':
        action = request.POST.get('action')

        if action == 'toggle_duty' and employee:
            new_status = 'on_leave' if employee.status == 'active' else 'active'
            employee.status = new_status
            employee.save()
            status_label = 'On Duty (Active)' if new_status == 'active' else 'Off Duty (On Leave)'
            messages.success(request, f'Your status is now {status_label}.')

        elif action == 'update_booking_status' and employee:
            booking_id = request.POST.get('booking_id')
            new_status = request.POST.get('status')
            booking = get_object_or_404_safe(Booking, booking_id, assigned_beautician=employee)

            # This generic action previously accepted ANY Booking status
            # value directly — an employee could POST status=in_progress
            # (or completed, once paid) straight from "upcoming",
            # completely skipping On The Way -> arrival photo -> OTP
            # (mark_on_the_way/upload_verification/verify_start_otp,
            # which each enforce their own precondition). Restricted to
            # its one legitimate use from the UI: finishing a job that's
            # already been properly started.
            if new_status != 'completed':
                messages.error(request, 'Invalid status transition.')
            elif booking.status != 'in_progress':
                messages.error(request, f'#{booking.booking_number} must be started (arrival OTP verified) before it can be completed.')
            elif booking.payment_status != 'paid':
                messages.error(request, f'Collect payment for #{booking.booking_number} before marking it Completed.')
            else:
                booking.status = new_status
                booking.save()
                messages.success(request, f'Order #{booking.booking_number} updated to {booking.get_status_display()}.')

        elif action == 'mark_paid' and employee:
            booking_id = request.POST.get('booking_id')
            booking = get_object_or_404_safe(Booking, booking_id, assigned_beautician=employee)
            booking.payment_status = 'paid'
            booking.save()
            messages.success(request, f'Order #{booking.booking_number} marked as Paid.')

        elif action == 'mark_on_the_way' and employee:
            booking_id = request.POST.get('booking_id')
            booking = get_object_or_404_safe(Booking, booking_id, assigned_beautician=employee)
            if booking.status == 'upcoming':
                booking.status = 'on_the_way'
                booking.save()
                messages.success(request, f'Order #{booking.booking_number} marked On The Way.')

        elif action == 'upload_verification' and employee:
            booking_id = request.POST.get('booking_id')
            booking = get_object_or_404_safe(Booking, booking_id, assigned_beautician=employee)
            photo = request.FILES.get('verification_photo')

            upload_error = validate_image_upload(photo) if photo else None

            if booking.status != 'on_the_way':
                messages.error(request, 'This job is not in the "On The Way" stage.')
            elif not photo:
                messages.error(request, 'Please take or choose a photo first.')
            elif upload_error:
                messages.error(request, upload_error)
            else:
                booking.verification_photo = photo
                booking.start_otp = _generate_otp()
                booking.otp_generated_at = timezone.now()
                booking.otp_verified_at = None
                booking.otp_failed_attempts = 0
                booking.save()
                messages.success(
                    request,
                    f'Arrival photo saved for #{booking.booking_number}. Ask the customer for the code '
                    f'shown on their Bookings page, then enter it below to start the job.',
                )

        elif action == 'regenerate_otp' and employee:
            booking_id = request.POST.get('booking_id')
            booking = get_object_or_404_safe(Booking, booking_id, assigned_beautician=employee)
            if booking.status == 'on_the_way' and booking.verification_photo:
                booking.start_otp = _generate_otp()
                booking.otp_generated_at = timezone.now()
                # A fresh code always means verification is pending again —
                # without this, a stale otp_verified_at from an earlier
                # verified cycle (e.g. status manually reset back to
                # on_the_way after already reaching in_progress once) keeps
                # the customer's OTP banner hidden forever, even though a
                # valid new code now exists (its condition requires
                # otp_verified_at to be empty).
                booking.otp_verified_at = None
                booking.otp_failed_attempts = 0
                booking.save()
                messages.success(request, f'New code generated for #{booking.booking_number} — ask the customer to refresh their Bookings page.')

        elif action == 'verify_start_otp' and employee:
            booking_id = request.POST.get('booking_id')
            entered_otp = request.POST.get('otp', '').strip()
            booking = get_object_or_404_safe(Booking, booking_id, assigned_beautician=employee)

            if booking.status != 'on_the_way':
                messages.error(request, 'This job is not in the "On The Way" stage.')
            elif not booking.start_otp or not booking.otp_generated_at:
                messages.error(request, 'No code has been generated yet — save an arrival photo first.')
            elif timezone.now() > booking.otp_generated_at + OTP_VALIDITY:
                messages.error(request, 'That code has expired — tap "Get New Code" and try again.')
            elif booking.otp_failed_attempts >= OTP_MAX_ATTEMPTS:
                messages.error(request, 'Too many incorrect attempts — tap "Get New Code" and try again.')
            elif entered_otp != booking.start_otp:
                booking.otp_failed_attempts += 1
                booking.save(update_fields=['otp_failed_attempts'])
                messages.error(request, 'Incorrect code. Double-check with the customer and try again.')
            else:
                booking.status = 'in_progress'
                booking.otp_verified_at = timezone.now()
                booking.otp_failed_attempts = 0
                booking.save()
                messages.success(request, f'Verified — #{booking.booking_number} is now Job Started.')

        elif action == 'upload_face_photos' and employee:
            slots = ['face_photo_front', 'face_photo_left', 'face_photo_right', 'face_photo_top', 'face_photo_bottom']
            uploaded = [name for name in slots if request.FILES.get(name)]
            upload_error = next(
                (err for name in uploaded if (err := validate_image_upload(request.FILES[name]))),
                None,
            )
            if not uploaded:
                messages.error(request, 'Please choose a photo first.')
            elif upload_error:
                messages.error(request, upload_error)
            else:
                for name in uploaded:
                    setattr(employee, name, request.FILES[name])
                employee.save()
                messages.success(request, 'Face photo saved.')

        elif action == 'update_profile' and employee:
            phone = request.POST.get('phone', '').strip()[:20]
            specialties = request.POST.get('specialties', '').strip()
            if phone and not looks_like_phone(phone):
                messages.error(request, 'Enter a valid phone number.')
            else:
                if phone:
                    employee.phone = phone
                if specialties:
                    employee.specialties = specialties
                employee.save()
                messages.success(request, 'Profile updated.')

        elif action == 'request_leave' and employee:
            start_date = parse_date(request.POST.get('start_date') or '')
            end_date = parse_date(request.POST.get('end_date') or '')
            reason = request.POST.get('reason', '').strip()

            if not start_date or not end_date:
                messages.error(request, 'Please provide both a start and end date.')
            elif end_date < start_date:
                messages.error(request, 'Leave end date cannot be before the start date.')
            elif start_date < today_date:
                messages.error(request, 'Leave start date cannot be in the past.')
            else:
                EmployeeLeave.objects.create(
                    employee=employee, start_date=start_date, end_date=end_date, reason=reason,
                )
                conflict_count = (
                    Booking.objects.filter(assigned_beautician=employee, scheduled_date__range=(start_date, end_date))
                    .exclude(status='cancelled')
                    .count()
                )
                if conflict_count:
                    messages.success(
                        request,
                        f'Leave requested — but you already have {conflict_count} job'
                        f'{"s" if conflict_count != 1 else ""} scheduled in this window. Let the owner know so they can reassign them.',
                    )
                else:
                    messages.success(request, 'Leave request added.')

        elif action == 'cancel_leave' and employee:
            leave_id = request.POST.get('leave_id', '')
            if leave_id.isdigit():
                EmployeeLeave.objects.filter(id=leave_id, employee=employee).delete()
                messages.success(request, 'Leave cancelled.')
            else:
                messages.error(request, 'Invalid leave id.')

        return redirect(request.get_full_path())

    # Get Assigned Bookings
    assigned_bookings = (
        Booking.objects.filter(assigned_beautician=employee)
        .select_related('user')
        .prefetch_related('items')
        if employee
        else Booking.objects.none()
    )

    today_bookings = assigned_bookings.filter(scheduled_date=today_date).exclude(status='cancelled')
    upcoming_bookings = assigned_bookings.filter(status__in=['upcoming', 'on_the_way', 'in_progress']).exclude(
        id__in=today_bookings.values_list('id', flat=True)
    )
    completed_bookings = assigned_bookings.filter(status='completed')

    # Metrics
    completed_count = completed_bookings.count()
    total_earnings = completed_bookings.aggregate(Sum('total_amount'))['total_amount__sum'] or 0

    upcoming_leaves = (
        employee.leaves.filter(end_date__gte=today_date) if employee else EmployeeLeave.objects.none()
    )

    # Calendar month navigation (?cal_year=&cal_month=) — defaults to the
    # current month. Clamped to valid values instead of 500ing on a
    # hand-edited/garbage query string.
    try:
        cal_year = int(request.GET.get('cal_year', today_date.year))
        cal_month = int(request.GET.get('cal_month', today_date.month))
        if not 1 <= cal_month <= 12:
            raise ValueError
    except ValueError:
        cal_year, cal_month = today_date.year, today_date.month

    prev_month, prev_year = (12, cal_year - 1) if cal_month == 1 else (cal_month - 1, cal_year)
    next_month, next_year = (1, cal_year + 1) if cal_month == 12 else (cal_month + 1, cal_year)

    context = {
        'page_title': 'Beautician Dashboard',
        'employee': employee,
        'today_bookings': today_bookings,
        'upcoming_bookings': upcoming_bookings,
        'completed_bookings': completed_bookings,
        'completed_count': completed_count,
        'total_earnings': total_earnings,
        'today_date': today_date,
        'upcoming_leaves': upcoming_leaves,
        'all_employees': Employee.objects.all() if user.is_staff else None,
        'calendar_weeks': _build_month_calendar(employee, cal_year, cal_month, today_date),
        'calendar_label': f'{MONTH_NAMES[cal_month - 1]} {cal_year}',
        'calendar_prev': {'month': prev_month, 'year': prev_year},
        'calendar_next': {'month': next_month, 'year': next_year},
    }
    return render(request, 'employee_dashboard/emp_dashboard.html', context)
