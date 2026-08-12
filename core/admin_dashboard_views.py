import calendar as calendar_module
import secrets
from datetime import datetime, timedelta
from datetime import time as dt_time

MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]

from django.contrib import messages
from django.contrib.auth.models import Group, User
from django.db import transaction
from django.db.models import Count, F, Min, Prefetch, ProtectedError, Q, Sum
from django.shortcuts import redirect, render
from django.utils import timezone
from django.utils.dateparse import parse_date

from accounts.models import Employee, EmployeeLeave
from accounts.utils import generate_username_from_name
from bookings.models import Booking, Offer
from catalog.models import Category, Package, Service, ServiceVariant
from core.decorators import owner_required
from core.utils import (
    generate_unique_slug, get_object_or_404_safe, looks_like_phone,
    paginate_queryset, parse_duration, parse_money, validate_image_upload, validate_url,
)

# Fixed windows for regular bookings — mirrors Booking.SLOT_CHOICES'
# labels. Used only to detect same-day beautician double-bookings for the
# "Assigned Staff" dropdown (see _annotate_beautician_conflicts) — not a
# scheduling gate, just visibility for the owner before they assign.
SLOT_WINDOWS = {
    'morning': (dt_time(8, 0), dt_time(12, 0)),
    'afternoon': (dt_time(12, 0), dt_time(16, 0)),
    'evening': (dt_time(16, 0), dt_time(20, 0)),
}


def _booking_time_window(booking):
    """(start, end) as datetime.time for overlap comparisons — a fixed
    slot window for regular bookings, or the requested start time plus
    the sum of its items' snapshotted durations for urgent ones. None if
    the booking has no resolvable window (shouldn't happen for a saved
    booking, but defensive)."""
    if booking.booking_type == 'regular':
        return SLOT_WINDOWS.get(booking.time_slot)
    if booking.exact_time:
        total_minutes = sum(item.duration_snapshot * item.quantity for item in booking.items.all())
        start_dt = datetime.combine(booking.scheduled_date, booking.exact_time)
        end_dt = start_dt + timedelta(minutes=total_minutes or 60)
        return booking.exact_time, end_dt.time()
    return None


def _windows_overlap(a, b):
    return a[0] < b[1] and b[0] < a[1]


def _annotate_beautician_conflicts(bookings_page):
    """
    Attaches `.conflicting_beautician_ids` (a set) to each booking in
    `bookings_page` — the employees who already have another active,
    time-overlapping booking on that same date. Surfaced in the "Assigned
    Staff" dropdown so the owner can see a scheduling clash before
    assigning, not just after (see AUDIT_FINDINGS.md "Missing features").
    Only looks at the current page's bookings, not the whole table.
    """
    bookings_page = list(bookings_page)
    dates = {b.scheduled_date for b in bookings_page}
    if not dates:
        return

    other_bookings = list(
        Booking.objects.filter(scheduled_date__in=dates, assigned_beautician__isnull=False)
        .exclude(status='cancelled')
        .prefetch_related('items')
    )
    by_date = {}
    for ob in other_bookings:
        by_date.setdefault(ob.scheduled_date, []).append(ob)

    for booking in bookings_page:
        window = _booking_time_window(booking)
        conflicting_ids = set()
        if window:
            for other in by_date.get(booking.scheduled_date, []):
                if other.id == booking.id:
                    continue
                other_window = _booking_time_window(other)
                if other_window and _windows_overlap(window, other_window):
                    conflicting_ids.add(other.assigned_beautician_id)
        booking.conflicting_beautician_ids = conflicting_ids


def _create_employee_login(name):
    """
    Auto-provisions a login for a newly added employee: username is
    firstname+lastname (lowercased, collision-suffixed), password is
    Firstname + 4 random digits — simple enough for the owner to read
    off-screen and hand to a new hire without a separate invite flow,
    but not computable by anyone who just knows the employee's first
    name (the previous fixed "Firstname2026" scheme was — employee
    first names are shown to customers throughout the app, so that
    was a directly guessable login for every employee, every year).
    Returns (user, plaintext_password) so the caller can show the password
    once, since it's never recoverable again after this (only the hash is
    stored).
    """
    parts = name.split()
    first_name = parts[0] if parts else 'user'
    last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

    username = generate_username_from_name(first_name, last_name)
    password = _generate_temp_password(first_name)

    user = User.objects.create_user(
        username=username, password=password,
        first_name=first_name, last_name=last_name,
    )
    # 'emp' role group — see accounts/adapter.py::save_user for the
    # self-signup 'customer' side of this, and core/decorators.py /
    # core/middleware.py for how the three groups gate access. Never
    # is_staff — that flag used to be (incorrectly) relied on for
    # dashboard access; group membership is the only thing that matters
    # now, and is_staff stays reserved for real Django-admin-site access.
    emp_group, _ = Group.objects.get_or_create(name='emp')
    user.groups.add(emp_group)
    return user, password


def _generate_temp_password(first_name):
    """Firstname + 4 random digits — same scheme _create_employee_login
    uses for a brand-new login, reused for resetting an existing one
    (see 'reset_password' action below) so a forgotten password gets
    replaced with something equally easy to read off-screen and hand
    over, not a second bespoke scheme."""
    suffix = ''.join(secrets.choice('0123456789') for _ in range(4))
    return f'{first_name.capitalize()}{suffix}'


@owner_required
def dashboard_overview(request):
    """
    Combined Main Overview for Owner/Admin Dashboard:
    KPI metrics, Order Lifecycle breakdown, Master Staff Schedule & Calendar,
    1-click work assignment/reassignment, and Recent Orders.
    """
    today_date = timezone.now().date()

    if request.method == 'POST':
        action = request.POST.get('action')

        if action == 'assign_beautician':
            booking_id = request.POST.get('booking_id')
            beautician_id = request.POST.get('beautician_id')

            booking = get_object_or_404_safe(Booking, booking_id)
            if beautician_id and beautician_id.isdigit():
                beautician = get_object_or_404_safe(Employee, beautician_id)
                booking.assigned_beautician = beautician
                booking.save(update_fields=['assigned_beautician'])
                messages.success(request, f'Order #{booking.booking_number} assigned to {beautician.name}.')
            else:
                booking.assigned_beautician = None
                booking.save(update_fields=['assigned_beautician'])
                messages.success(request, f'Order #{booking.booking_number} set to Unassigned.')

        return redirect(request.get_full_path())

    total_bookings = Booking.objects.count()
    completed_bookings = Booking.objects.filter(status='completed')
    total_revenue = completed_bookings.aggregate(Sum('total_amount'))['total_amount__sum'] or 0

    upcoming_count = Booking.objects.filter(status='upcoming').count()
    in_progress_count = Booking.objects.filter(status='in_progress').count()
    completed_count = completed_bookings.count()
    cancelled_count = Booking.objects.filter(status='cancelled').count()

    active_services_count = Service.objects.filter(is_active=True).count() + Package.objects.filter(is_active=True).count()
    total_services_count = Service.objects.count() + Package.objects.count()

    active_staff_count = Employee.objects.filter(status='active').count()
    total_staff_count = Employee.objects.count()

    recent_bookings = (
        Booking.objects.select_related('user', 'assigned_beautician')
        .prefetch_related('items')[:6]
    )

    # Date navigation for calendar
    selected_date_str = request.GET.get('date')
    selected_date = parse_date(selected_date_str) if selected_date_str else today_date
    if not selected_date:
        selected_date = today_date

    try:
        year = int(request.GET.get('year', selected_date.year))
        month = int(request.GET.get('month', selected_date.month))
        if not 1 <= month <= 12:
            raise ValueError
    except ValueError:
        year, month = selected_date.year, selected_date.month

    # Build month grid
    cal = calendar_module.Calendar(firstweekday=6)
    month_dates = list(cal.itermonthdates(year, month))
    range_start, range_end = month_dates[0], month_dates[-1]

    # Fetch all employees
    employees = Employee.objects.all().order_by('name')

    # Fetch bookings in date range
    bookings_qs = Booking.objects.filter(
        scheduled_date__range=(range_start, range_end)
    ).exclude(status='cancelled').select_related('assigned_beautician', 'user').prefetch_related('items')

    # Group bookings by date
    bookings_by_date = {}
    for b in bookings_qs:
        bookings_by_date.setdefault(b.scheduled_date, []).append(b)

    # Fetch employee leaves in range
    leaves_qs = EmployeeLeave.objects.filter(
        start_date__lte=range_end, end_date__gte=range_start
    ).select_related('employee')

    leaves_by_date = {}
    for leave in leaves_qs:
        d = max(leave.start_date, range_start)
        last = min(leave.end_date, range_end)
        while d <= last:
            leaves_by_date.setdefault(d, []).append(leave.employee_id)
            d += timedelta(days=1)

    # Build calendar weeks structure
    weeks, week = [], []
    for d in month_dates:
        day_bookings = bookings_by_date.get(d, [])
        unassigned_count = sum(1 for b in day_bookings if not b.assigned_beautician_id)
        leave_emp_ids = set(leaves_by_date.get(d, []))
        has_conflict = any(b.assigned_beautician_id in leave_emp_ids for b in day_bookings if b.assigned_beautician_id)

        week.append({
            'date': d,
            'day': d.day,
            'in_month': d.month == month,
            'is_today': d == today_date,
            'is_selected': d == selected_date,
            'total_jobs': len(day_bookings),
            'unassigned_jobs': unassigned_count,
            'leave_count': len(leave_emp_ids),
            'has_conflict': has_conflict,
        })
        if len(week) == 7:
            weeks.append(week)
            week = []

    # Selected date breakdown for the daily roster
    selected_day_bookings = bookings_by_date.get(selected_date, [])
    selected_day_leaves = set(leaves_by_date.get(selected_date, []))

    staff_roster = []
    for emp in employees:
        emp_jobs = [b for b in selected_day_bookings if b.assigned_beautician_id == emp.id]
        is_on_leave = emp.id in selected_day_leaves

        # Time slot conflict detection
        slot_counts = {}
        for b in emp_jobs:
            slot = b.time_slot or 'flexible'
            slot_counts[slot] = slot_counts.get(slot, 0) + 1

        has_time_conflict = any(count > 1 for slot, count in slot_counts.items() if slot != 'flexible')
        for b in emp_jobs:
            b.has_slot_conflict = bool(b.time_slot and slot_counts.get(b.time_slot, 0) > 1)

        busy_slots = [b.time_slot for b in emp_jobs if b.time_slot]

        staff_roster.append({
            'employee': emp,
            'jobs': emp_jobs,
            'is_on_leave': is_on_leave,
            'is_busy': len(emp_jobs) > 0,
            'has_conflict': (is_on_leave and len(emp_jobs) > 0) or has_time_conflict,
            'has_leave_conflict': is_on_leave and len(emp_jobs) > 0,
            'has_time_conflict': has_time_conflict,
            'busy_slots': ','.join(busy_slots),
        })

    unassigned_day_jobs = [b for b in selected_day_bookings if not b.assigned_beautician_id]

    prev_month, prev_year = (12, year - 1) if month == 1 else (month - 1, year)
    next_month, next_year = (1, year + 1) if month == 12 else (month + 1, year)

    today_bookings_count = len(bookings_by_date.get(today_date, []))
    today_leaves_count = len(set(leaves_by_date.get(today_date, [])))

    context = {
        'page_title': 'Dashboard Overview',
        'active_nav': 'overview',
        'total_bookings': total_bookings,
        'total_revenue': total_revenue,
        'upcoming_count': upcoming_count,
        'in_progress_count': in_progress_count,
        'completed_count': completed_count,
        'cancelled_count': cancelled_count,
        'active_services_count': active_services_count,
        'total_services_count': total_services_count,
        'active_staff_count': active_staff_count,
        'total_staff_count': total_staff_count,
        'recent_bookings': recent_bookings,
        # Schedule & Calendar Context
        'today_date': today_date,
        'selected_date': selected_date,
        'year': year,
        'month': month,
        'calendar_label': f'{MONTH_NAMES[month - 1]} {year}',
        'calendar_prev': {'month': prev_month, 'year': prev_year},
        'calendar_next': {'month': next_month, 'year': next_year},
        'calendar_weeks': weeks,
        'staff_roster': staff_roster,
        'unassigned_day_jobs': unassigned_day_jobs,
        'all_employees': employees,
        'schedule_metrics': {
            'active_staff': active_staff_count,
            'today_jobs': today_bookings_count,
            'today_leaves': today_leaves_count,
            'unassigned_today': sum(1 for b in bookings_by_date.get(today_date, []) if not b.assigned_beautician_id),
        }
    }
    return render(request, 'admin_dashboard/overview.html', context)


@owner_required
def dashboard_bookings(request):
    """
    Order / Booking management page: view all orders, filter by status or search,
    update order status, payment status, and assign beautician.
    """
    status_filter = request.GET.get('status', 'all')
    search_query = request.GET.get('q', '').strip()
    date_filter = request.GET.get('date', '').strip()

    bookings_qs = Booking.objects.select_related('user', 'assigned_beautician').prefetch_related('items')

    if status_filter in ['upcoming', 'in_progress', 'completed', 'cancelled']:
        bookings_qs = bookings_qs.filter(status=status_filter)

    if search_query:
        bookings_qs = bookings_qs.filter(
            Q(booking_number__icontains=search_query)
            | Q(user__email__icontains=search_query)
            | Q(user__first_name__icontains=search_query)
            | Q(user__last_name__icontains=search_query)
            | Q(address_text__icontains=search_query)
            | Q(address_label__icontains=search_query)
        )

    if date_filter:
        # parse_date rejects a malformed ?date= (e.g. "not-a-date") instead
        # of letting the queryset evaluation below raise ValidationError.
        parsed_date_filter = parse_date(date_filter)
        if parsed_date_filter:
            bookings_qs = bookings_qs.filter(scheduled_date=parsed_date_filter)
        else:
            date_filter = ''

    if request.method == 'POST':
        action = request.POST.get('action')
        booking_id = request.POST.get('booking_id')
        if not booking_id:
            messages.error(request, 'No booking selected.')
            return redirect(request.get_full_path())
        booking = get_object_or_404_safe(Booking, booking_id)

        if action == 'update_status':
            new_status = request.POST.get('status')
            new_payment = request.POST.get('payment_status')
            effective_payment = new_payment if new_payment in dict(Booking.PAYMENT_STATUS_CHOICES) else booking.payment_status

            if new_status == 'completed' and effective_payment != 'paid':
                messages.error(request, f'Mark #{booking.booking_number} as Paid before completing it.')
            else:
                if new_status in dict(Booking.STATUS_CHOICES):
                    booking.status = new_status
                if new_payment in dict(Booking.PAYMENT_STATUS_CHOICES):
                    booking.payment_status = new_payment
                booking.save()
                messages.success(request, f'Order #{booking.booking_number} status updated to {booking.get_status_display()}.')

        elif action == 'assign_beautician':
            beautician_id = request.POST.get('beautician_id')
            if beautician_id:
                beautician = get_object_or_404_safe(Employee, beautician_id)
                booking.assigned_beautician = beautician
                messages.success(request, f'Assigned {beautician.name} to Order #{booking.booking_number}.')
            else:
                booking.assigned_beautician = None
                messages.info(request, f'Unassigned beautician from Order #{booking.booking_number}.')
            booking.save()

        return redirect(request.get_full_path())

    employees = Employee.objects.all()

    page_obj, other_params = paginate_queryset(request, bookings_qs)
    _annotate_beautician_conflicts(page_obj)

    context = {
        'page_title': 'Booking & Order Management',
        'active_nav': 'bookings',
        'bookings': page_obj,
        'page_obj': page_obj,
        'other_params': other_params,
        'employees': employees,
        'status_filter': status_filter,
        'search_query': search_query,
        'date_filter': date_filter,
        'status_choices': Booking.STATUS_CHOICES,
        'payment_status_choices': Booking.PAYMENT_STATUS_CHOICES,
    }
    return render(request, 'admin_dashboard/bookings_list.html', context)


def _handle_catalog_post_action(request, locked_kind):
    """
    Every add/edit/delete/toggle action for both the Services page and
    the Packages page — shared because toggling/deleting/editing the
    common fields (name, category, photo, description, badges) works
    identically either way. `locked_kind` (fixed per call site — see
    dashboard_services/dashboard_packages below) picks `Service` or
    `Package` — separate tables/id-namespaces since the catalog model
    split (2026-08-08), so a submitted `service_id` is only ever looked
    up against the model matching whichever page the request came from.

    The per-variant actions (add_variant/update_variant_price/
    delete_variant) are Service-only and hardcode `ServiceVariant` —
    a package has no separate variant model (see Package's docstring in
    catalog/models.py: its own price/mrp/duration_mins live directly on
    the Package row), and the admin UI never renders those buttons on
    the Packages page. Always redirects back to wherever the request
    came from.
    """
    ItemModel = Package if locked_kind == 'package' else Service

    action = request.POST.get('action')

    if action == 'toggle_service':
        item_id = request.POST.get('service_id')
        item = get_object_or_404_safe(ItemModel, item_id)
        item.is_active = not item.is_active
        item.save()
        status_str = 'enabled' if item.is_active else 'disabled'
        messages.success(request, f'"{item.name}" has been {status_str}.')

    elif action == 'delete_service':
        item_id = request.POST.get('service_id')
        item = get_object_or_404_safe(ItemModel, item_id)
        name = item.name
        item.delete()
        messages.success(request, f'"{name}" deleted successfully.')

    elif action == 'edit_service':
        item_id = request.POST.get('service_id')
        item = get_object_or_404_safe(ItemModel, item_id)
        name = request.POST.get('name', '').strip()[:140]
        category_id = request.POST.get('category_id')
        description = request.POST.get('description', '').strip()
        badges_str = request.POST.get('badges', '').strip()
        included_service_ids = request.POST.getlist('included_service_ids')
        photo_image = request.FILES.get('photo_image')
        photo_url = request.POST.get('photo_url', '').strip()[:500]

        photo_error = None
        if photo_image:
            photo_error = validate_image_upload(photo_image)
        elif photo_url:
            photo_error = validate_url(photo_url, 'Photo URL')

        # Only a package edits its own price/mrp/duration here — a
        # service's live entirely on ServiceVariant rows, edited via the
        # separate Add/Edit Variant actions below.
        price = mrp = duration_mins = None
        price_error = None
        if locked_kind == 'package':
            price, price_error = parse_money(request.POST.get('price'), 'Price')
            if not price_error:
                mrp, price_error = parse_money(request.POST.get('mrp'), 'MRP', required=False)
            if not price_error:
                duration_mins, price_error = parse_duration(request.POST.get('duration_mins'), 'Duration', default=30)

        if photo_error:
            messages.error(request, photo_error)
        elif price_error:
            messages.error(request, price_error)
        elif name and category_id:
            category = get_object_or_404_safe(Category, category_id)
            item.name = name
            item.category = category
            item.description = description
            if badges_str:
                item.badges = [b.strip() for b in badges_str.split(',') if b.strip()]
            else:
                item.badges = []
            if photo_image:
                item.photo_image = photo_image
                item.photo_url = ''
            elif photo_url:
                item.photo_url = photo_url
            if locked_kind == 'package':
                item.price = price
                item.mrp = mrp
                item.duration_mins = duration_mins
            item.save()

            if locked_kind == 'package':
                # Filter to real, existing single services rather than
                # trusting the submitted ids outright — a stale/tampered
                # id would otherwise hit the M2M through-table's FK
                # constraint and 500 instead of just being dropped.
                valid_ids = Service.objects.filter(id__in=included_service_ids).values_list('id', flat=True)
                item.included_services.set(valid_ids)
                # Auto-calculated totals win over the manually-typed
                # mrp/duration above whenever services are actually
                # selected — same precedence as add_service below.
                auto_dur = item.total_included_duration
                auto_mrp = item.total_included_mrp
                update_fields = []
                if auto_dur > 0:
                    item.duration_mins = auto_dur
                    update_fields.append('duration_mins')
                if auto_mrp > 0:
                    item.mrp = auto_mrp
                    update_fields.append('mrp')
                if update_fields:
                    item.save(update_fields=update_fields)

            messages.success(request, f'Updated details for "{name}".')
        else:
            messages.error(request, 'Name and category are required.')

    elif action == 'add_service':
        name = request.POST.get('name', '').strip()[:140]
        category_id = request.POST.get('category_id')
        description = request.POST.get('description', '').strip()
        badges_str = request.POST.get('badges', '').strip()
        photo_image = request.FILES.get('photo_image')
        photo_url = request.POST.get('photo_url', '').strip()[:500]

        photo_error = None
        if photo_image:
            photo_error = validate_image_upload(photo_image)
        elif photo_url:
            photo_error = validate_url(photo_url, 'Photo URL')

        if photo_error:
            messages.error(request, photo_error)
        elif not (name and category_id):
            messages.error(request, 'Name and category are required.')
        else:
            category = get_object_or_404_safe(Category, category_id)
            slug = generate_unique_slug(ItemModel, name)
            badges = [b.strip() for b in badges_str.split(',') if b.strip()] if badges_str else []
            base_fields = dict(
                name=name,
                slug=slug,
                category=category,
                description=description,
                photo='images/portfolio-1.jpg',
                photo_image=photo_image,
                # A file upload wins over a URL when both are
                # given — matches display_photo_url's own
                # priority order.
                photo_url='' if photo_image else photo_url,
                tone='espresso',
                badges=badges,
                is_active=True,
            )

            if locked_kind == 'package':
                included_service_ids = request.POST.getlist('included_service_ids')
                price, error = parse_money(request.POST.get('price'), 'Price')
                mrp = duration_mins = None
                if not error:
                    mrp, error = parse_money(request.POST.get('mrp'), 'MRP', required=False)
                if not error:
                    duration_mins, error = parse_duration(request.POST.get('duration_mins'), 'Duration', default=30)

                if error:
                    messages.error(request, error)
                else:
                    with transaction.atomic():
                        item = Package.objects.create(price=price, mrp=mrp, duration_mins=duration_mins, **base_fields)
                        if included_service_ids:
                            valid_ids = Service.objects.filter(id__in=included_service_ids).values_list('id', flat=True)
                            item.included_services.set(valid_ids)
                            auto_dur = item.total_included_duration
                            auto_mrp = item.total_included_mrp
                            update_fields = []
                            if auto_dur > 0:
                                item.duration_mins = auto_dur
                                update_fields.append('duration_mins')
                            if auto_mrp > 0:
                                item.mrp = auto_mrp
                                update_fields.append('mrp')
                            if update_fields:
                                item.save(update_fields=update_fields)
                    messages.success(request, f'Created new package "{name}".')
            else:
                variant_labels = request.POST.getlist('variant_label')
                variant_prices = request.POST.getlist('variant_price')
                variant_mrps = request.POST.getlist('variant_mrp')
                variant_durations = request.POST.getlist('variant_duration')

                if not variant_prices:
                    messages.error(request, 'At least one price is required.')
                else:
                    # Parse every variant row up front — reject the whole
                    # submission on the first bad price/duration instead of
                    # partially creating the service with some variants
                    # silently skipped (the previous `if not p_val: continue`
                    # behavior — a typo'd price row just vanished with no
                    # feedback).
                    parsed_variants = []
                    error = None
                    for idx in range(len(variant_prices)):
                        p_val = variant_prices[idx]
                        if not p_val:
                            continue
                        price, error = parse_money(p_val, f'Variant {idx + 1} price')
                        if error:
                            break
                        lbl = variant_labels[idx].strip()[:60] if idx < len(variant_labels) else ''
                        mrp_raw = variant_mrps[idx] if idx < len(variant_mrps) else ''
                        mrp, error = parse_money(mrp_raw, f'Variant {idx + 1} MRP', required=False)
                        if error:
                            break
                        dur_raw = variant_durations[idx] if idx < len(variant_durations) else ''
                        dur_val, error = parse_duration(dur_raw, f'Variant {idx + 1} duration', default=30)
                        if error:
                            break
                        parsed_variants.append((lbl, price, mrp, dur_val))

                    if error:
                        messages.error(request, error)
                    elif not parsed_variants:
                        messages.error(request, 'At least one variant with a valid price is required.')
                    else:
                        with transaction.atomic():
                            item = Service.objects.create(**base_fields)
                            for created_count, (lbl, price, mrp, dur_val) in enumerate(parsed_variants):
                                ServiceVariant.objects.create(
                                    service=item,
                                    label=lbl,
                                    duration_mins=dur_val,
                                    price=price,
                                    mrp=mrp,
                                    is_default=created_count == 0,
                                    is_active=True,
                                    sort_order=created_count,
                                )
                        messages.success(request, f'Created new service "{name}" with {len(parsed_variants)} variant(s).')

    elif action == 'add_variant':
        # Service-only — see this function's docstring.
        item = get_object_or_404_safe(Service, request.POST.get('service_id'))
        label = request.POST.get('label', '').strip()[:60]
        price_raw = request.POST.get('price')
        mrp_raw = request.POST.get('mrp')
        duration_raw = request.POST.get('duration_mins', 30)
        is_default = request.POST.get('is_default') == 'on'

        price, error = parse_money(price_raw, 'Price')
        mrp, mrp_error = (None, None)
        duration_mins, dur_error = (None, None)
        if not error:
            mrp, mrp_error = parse_money(mrp_raw, 'MRP', required=False)
        if not error and not mrp_error:
            duration_mins, dur_error = parse_duration(duration_raw, default=30)
        error = error or mrp_error or dur_error

        if error:
            messages.error(request, error)
        else:
            with transaction.atomic():
                if is_default:
                    item.variants.update(is_default=False)

                ServiceVariant.objects.create(
                    service=item,
                    label=label,
                    price=price,
                    mrp=mrp,
                    duration_mins=duration_mins,
                    is_default=is_default or not item.variants.exists(),
                    is_active=True,
                )
            messages.success(request, f'Added new variant to "{item.name}".')

    elif action == 'update_variant_price':
        # Service-only — see this function's docstring.
        variant = get_object_or_404_safe(ServiceVariant, request.POST.get('variant_id'))
        parent = variant.service
        label = request.POST.get('label', '').strip()[:60]
        price_raw = request.POST.get('price')
        mrp_raw = request.POST.get('mrp')
        duration_raw = request.POST.get('duration_mins')
        is_default = request.POST.get('is_default') == 'on'

        price, error = parse_money(price_raw, 'Price')
        mrp, mrp_error = (None, None)
        duration_mins, dur_error = (None, None)
        if not error:
            mrp, mrp_error = parse_money(mrp_raw, 'MRP', required=False)
        if not error and not mrp_error:
            duration_mins, dur_error = parse_duration(duration_raw, 'Duration')
        error = error or mrp_error or dur_error

        if error:
            messages.error(request, error)
        else:
            with transaction.atomic():
                if is_default and not variant.is_default:
                    parent.variants.update(is_default=False)

                variant.label = label
                variant.price = price
                variant.mrp = mrp
                variant.duration_mins = duration_mins
                variant.is_default = is_default
                variant.save()
            messages.success(request, f'Updated variant details for "{parent.name}".')

    elif action == 'delete_variant':
        # Service-only — see this function's docstring.
        variant = get_object_or_404_safe(ServiceVariant, request.POST.get('variant_id'))
        parent = variant.service
        if parent.variants.count() <= 1:
            messages.error(request, 'Cannot delete the only variant. Delete the entire item instead.')
        else:
            variant.delete()
            if not parent.variants.filter(is_default=True).exists():
                first_var = parent.variants.first()
                if first_var:
                    first_var.is_default = True
                    first_var.save()
            messages.success(request, f'Deleted variant from "{parent.name}".')

    return redirect(request.get_full_path())


SORT_OPTIONS = {
    '-created_at': ('-created_at',),
    'created_at': ('created_at',),
    'name': ('name',),
    '-name': ('-name',),
    'price': ('sort_price', 'name'),
    '-price': ('-sort_price', 'name'),
}


def _dashboard_catalog_list(request, locked_kind, page_title, active_nav, template_name):
    """
    Shared GET-side listing for the Services and Packages admin pages —
    each is now its own page/URL rather than one list with an All/
    Services/Packages filter tab, so `locked_kind` is fixed per call
    site, not read from the querystring. See _handle_catalog_post_action
    for the (kind-agnostic) POST side both pages share.
    """
    if request.method == 'POST':
        return _handle_catalog_post_action(request, locked_kind)

    ItemModel = Package if locked_kind == 'package' else Service

    category_slug = request.GET.get('category', 'all')
    search_query = request.GET.get('q', '').strip()
    sort = request.GET.get('sort', '-created_at')

    services_qs = ItemModel.objects.select_related('category')
    if locked_kind == 'package':
        services_qs = services_qs.prefetch_related('included_services__variants')
    else:
        services_qs = services_qs.prefetch_related('variants')

    if category_slug != 'all':
        services_qs = services_qs.filter(category__slug=category_slug)

    if search_query:
        services_qs = services_qs.filter(
            Q(name__icontains=search_query) | Q(description__icontains=search_query) | Q(slug__icontains=search_query)
        )

    if locked_kind == 'package':
        # A package's price is its own field now (see catalog/models.py)
        # — nothing to annotate, unlike Service below.
        services_qs = services_qs.annotate(sort_price=F('price'))
    else:
        # "Price" isn't a field on Service itself (it lives on
        # ServiceVariant, since one service can have several) — annotate
        # the lowest active variant price so "sort by price" has
        # something concrete to order by.
        services_qs = services_qs.annotate(
            sort_price=Min('variants__price', filter=Q(variants__is_active=True))
        )
    services_qs = services_qs.order_by(*SORT_OPTIONS.get(sort, SORT_OPTIONS['-created_at']))

    categories = Category.objects.all()
    single_services = Service.objects.filter(is_active=True).prefetch_related('variants').order_by('name')

    page_obj, other_params = paginate_queryset(request, services_qs)

    context = {
        'page_title': page_title,
        'active_nav': active_nav,
        'services': page_obj,
        'page_obj': page_obj,
        'other_params': other_params,
        'categories': categories,
        'single_services': single_services,
        'category_slug': category_slug,
        'search_query': search_query,
        'sort': sort,
        'locked_kind': locked_kind,
    }
    return render(request, template_name, context)


@owner_required
def dashboard_services(request):
    """Single-service catalog management — see _dashboard_catalog_list."""
    return _dashboard_catalog_list(
        request, locked_kind='service', page_title='Service Catalog Management',
        active_nav='services', template_name='admin_dashboard/services_list.html',
    )


@owner_required
def dashboard_packages(request):
    """Package catalog management — see _dashboard_catalog_list. Split
    out from dashboard_services (2026-08-08) so packages aren't mixed
    into the services list behind a filter tab anymore; its own template
    (2026-08-08) rather than a shared one, since Service/Package are
    separate models with a genuinely different add/edit form now (a
    package has its own price/mrp/duration fields directly plus an
    included-services checklist, not a list of variant rows)."""
    return _dashboard_catalog_list(
        request, locked_kind='package', page_title='Package Management',
        active_nav='packages', template_name='admin_dashboard/packages_list.html',
    )


@owner_required
def dashboard_employees(request):
    """
    Employee / Beautician management page: list employees, add staff,
    edit experience/specialties, and toggle active/leave status.
    """
    if request.method == 'POST':
        action = request.POST.get('action')

        if action == 'add_employee':
            name = request.POST.get('name', '').strip()[:100]
            phone = request.POST.get('phone', '').strip()[:20]
            email = request.POST.get('email', '').strip()
            specialties = request.POST.get('specialties', '').strip()
            experience_raw = request.POST.get('experience_years', '1')
            status = request.POST.get('status', 'active')

            error = None
            if not name or not phone:
                error = 'Name and phone are required.'
            elif not looks_like_phone(phone):
                error = 'Enter a valid phone number.'
            elif status not in dict(Employee.STATUS_CHOICES):
                error = 'Invalid status.'
            elif email and User.objects.filter(email__iexact=email).exists():
                error = 'That email is already in use by another account.'
            else:
                try:
                    experience_years = int(experience_raw)
                except (TypeError, ValueError):
                    error = 'Experience (years) must be a whole number.'
                else:
                    if not (0 <= experience_years <= 60):
                        error = 'Experience (years) must be between 0 and 60.'

            if error:
                messages.error(request, error)
            else:
                with transaction.atomic():
                    user, password = _create_employee_login(name)
                    if email:
                        user.email = email
                        user.save(update_fields=['email'])
                    Employee.objects.create(
                        user=user,
                        slug=generate_unique_slug(Employee, name),
                        name=name,
                        phone=phone,
                        email=email,
                        specialties=specialties or 'General Beauty',
                        experience_years=experience_years,
                        status=status,
                    )
                messages.success(
                    request,
                    f'Employee "{name}" added. Login — username: {user.username}, '
                    f'password: {password} (share with them now; the password can\'t be shown again).',
                )

        elif action == 'update_employee':
            employee_id = request.POST.get('employee_id')
            employee = get_object_or_404_safe(Employee, employee_id)

            phone = request.POST.get('phone', employee.phone).strip()[:20]
            email = request.POST.get('email', employee.email).strip()
            status = request.POST.get('status', employee.status)
            exp_raw = request.POST.get('experience_years')

            error = None
            if not looks_like_phone(phone):
                error = 'Enter a valid phone number.'
            elif status not in dict(Employee.STATUS_CHOICES):
                error = 'Invalid status.'
            elif email and User.objects.filter(email__iexact=email).exclude(pk=employee.user_id).exists():
                error = 'That email is already in use by another account.'
            elif exp_raw:
                try:
                    exp = int(exp_raw)
                except (TypeError, ValueError):
                    error = 'Experience (years) must be a whole number.'
                else:
                    if not (0 <= exp <= 60):
                        error = 'Experience (years) must be between 0 and 60.'

            if error:
                messages.error(request, error)
            else:
                with transaction.atomic():
                    employee.name = request.POST.get('name', employee.name).strip()[:100]
                    employee.phone = phone
                    employee.email = email
                    employee.specialties = request.POST.get('specialties', employee.specialties).strip()
                    employee.status = status
                    if exp_raw:
                        employee.experience_years = int(exp_raw)
                    employee.save()
                    if employee.user and employee.user.email != email:
                        employee.user.email = email
                        employee.user.save(update_fields=['email'])
                messages.success(request, f'Updated employee "{employee.name}".')

        elif action == 'generate_login':
            employee_id = request.POST.get('employee_id')
            employee = get_object_or_404_safe(Employee, employee_id)

            if employee.user:
                messages.error(request, f'"{employee.name}" already has a login ({employee.user.username}).')
            elif employee.email and User.objects.filter(email__iexact=employee.email).exists():
                messages.error(request, 'That email is already in use by another account — update it on this employee first.')
            else:
                with transaction.atomic():
                    user, password = _create_employee_login(employee.name)
                    if employee.email:
                        user.email = employee.email
                        user.save(update_fields=['email'])
                    employee.user = user
                    employee.save(update_fields=['user'])
                messages.success(
                    request,
                    f'Login created for "{employee.name}". Login — username: {user.username}, '
                    f'password: {password} (share with them now; the password can\'t be shown again).',
                )

        elif action == 'toggle_status':
            employee_id = request.POST.get('employee_id')
            employee = get_object_or_404_safe(Employee, employee_id)
            new_status = 'on_leave' if employee.status == 'active' else 'active'
            employee.status = new_status
            employee.save()
            messages.success(request, f'Status for "{employee.name}" updated to {employee.get_status_display()}.')

        elif action == 'reset_password':
            employee_id = request.POST.get('employee_id')
            employee = get_object_or_404_safe(Employee, employee_id)

            if not employee.user:
                messages.error(request, f'"{employee.name}" has no login yet — use "Generate Login" instead.')
            else:
                new_password = _generate_temp_password(employee.user.first_name or employee.name.split()[0])
                employee.user.set_password(new_password)
                employee.user.save(update_fields=['password'])
                messages.success(
                    request,
                    f'Password reset for "{employee.name}". New password: {new_password} '
                    f'(share with them now; it can\'t be shown again).',
                )

        elif action == 'toggle_login':
            employee_id = request.POST.get('employee_id')
            employee = get_object_or_404_safe(Employee, employee_id)

            if not employee.user:
                messages.error(request, f'"{employee.name}" has no login yet.')
            else:
                employee.user.is_active = not employee.user.is_active
                employee.user.save(update_fields=['is_active'])
                state = 'enabled' if employee.user.is_active else 'disabled'
                messages.success(request, f'Login {state} for "{employee.name}".')

        return redirect(request.get_full_path())

    employees_qs = Employee.objects.prefetch_related(
        'assigned_bookings',
        Prefetch(
            'leaves',
            queryset=EmployeeLeave.objects.filter(end_date__gte=timezone.now().date()),
            to_attr='upcoming_leaves',
        ),
    ).all()

    page_obj, other_params = paginate_queryset(request, employees_qs)

    context = {
        'page_title': 'Employee & Staff Management',
        'active_nav': 'employees',
        'employees': page_obj,
        'page_obj': page_obj,
        'other_params': other_params,
        'status_choices': Employee.STATUS_CHOICES,
    }
    return render(request, 'admin_dashboard/employees_list.html', context)


@owner_required
def dashboard_categories(request):
    """
    Category management: add/edit/delete, each with its own image and
    description for the marketing landing page's category grid (see
    core/booking_data.py::get_landing_categories()). `slug` is set once
    at creation and never edited afterward — same reasoning as
    dashboard_services' edit_service never touching Service.slug, since
    it's baked into `?category=<slug>` links and cart data throughout
    the marketing/booking flow.
    """
    if request.method == 'POST':
        action = request.POST.get('action')

        if action == 'add_category':
            name = request.POST.get('name', '').strip()[:60]
            description = request.POST.get('description', '').strip()
            image = request.FILES.get('image')
            image_url = request.POST.get('image_url', '').strip()[:500]

            error = None
            if not name:
                error = 'Category name is required.'
            elif image:
                error = validate_image_upload(image)
            elif image_url:
                error = validate_url(image_url, 'Image URL')

            if error:
                messages.error(request, error)
            else:
                Category.objects.create(
                    name=name,
                    slug=generate_unique_slug(Category, name),
                    description=description,
                    image=image,
                    # A file upload wins over a URL when both are given —
                    # matches Category.display_image_url's own priority.
                    image_url='' if image else image_url,
                )
                messages.success(request, f'Category "{name}" created.')

        elif action == 'edit_category':
            category_id = request.POST.get('category_id')
            category = get_object_or_404_safe(Category, category_id)
            name = request.POST.get('name', '').strip()[:60]
            description = request.POST.get('description', '').strip()
            image = request.FILES.get('image')
            image_url = request.POST.get('image_url', '').strip()[:500]

            error = None
            if not name:
                error = 'Category name is required.'
            elif image:
                error = validate_image_upload(image)
            elif image_url:
                error = validate_url(image_url, 'Image URL')

            if error:
                messages.error(request, error)
            else:
                category.name = name
                category.description = description
                if image:
                    category.image = image
                    category.image_url = ''
                elif image_url:
                    category.image_url = image_url
                category.save()
                messages.success(request, f'Category "{name}" updated.')

        elif action == 'delete_category':
            category_id = request.POST.get('category_id')
            category = get_object_or_404_safe(Category, category_id)
            name = category.name
            try:
                category.delete()
                messages.success(request, f'Category "{name}" deleted.')
            except ProtectedError:
                messages.error(
                    request,
                    f'Cannot delete "{name}" — it still has services assigned. '
                    f'Move or delete those services first.',
                )

        return redirect(request.get_full_path())

    categories_qs = Category.objects.annotate(service_count=Count('services')).order_by('id')
    page_obj, other_params = paginate_queryset(request, categories_qs)

    context = {
        'page_title': 'Category Management',
        'active_nav': 'categories',
        'categories': page_obj,
        'page_obj': page_obj,
        'other_params': other_params,
    }
    return render(request, 'admin_dashboard/categories_list.html', context)


@owner_required
def dashboard_offers(request):
    """
    Coupon/offer management: create, activate/deactivate, delete. `code`
    is what a customer types at checkout — see bookings/views.py::
    _resolve_cart_pricing, which reads real Offer rows now instead of
    the hardcoded COUPON_RATES dict this replaced. `title`/`description`
    are what's shown in the customer-facing "Offers" navbar dropdown
    (see core/booking_data.py::get_booking_offers()).
    """
    if request.method == 'POST':
        action = request.POST.get('action')

        if action == 'add_offer':
            code = request.POST.get('code', '').strip().upper()[:20]
            title = request.POST.get('title', '').strip()[:140]
            description = request.POST.get('description', '').strip()
            discount_raw = request.POST.get('discount_pct', '')

            error = None
            if not code or not title:
                error = 'Code and title are required.'
            elif Offer.objects.filter(code=code).exists():
                error = f'An offer with code "{code}" already exists.'
            else:
                try:
                    discount_pct = int(discount_raw)
                except (TypeError, ValueError):
                    discount_pct = None
                    error = 'Discount must be a whole number.'
                if discount_pct is not None and not (1 <= discount_pct <= 100):
                    error = 'Discount must be between 1 and 100.'

            if error:
                messages.error(request, error)
            else:
                Offer.objects.create(code=code, title=title, description=description, discount_pct=discount_pct)
                messages.success(request, f'Offer "{code}" created.')

        elif action == 'toggle_offer':
            offer_id = request.POST.get('offer_id')
            offer = get_object_or_404_safe(Offer, offer_id)
            offer.is_active = not offer.is_active
            offer.save(update_fields=['is_active'])
            state = 'activated' if offer.is_active else 'deactivated'
            messages.success(request, f'Offer "{offer.code}" {state}.')

        elif action == 'delete_offer':
            offer_id = request.POST.get('offer_id')
            offer = get_object_or_404_safe(Offer, offer_id)
            code = offer.code
            offer.delete()
            messages.success(request, f'Offer "{code}" deleted.')

        return redirect(request.get_full_path())

    offers_qs = Offer.objects.all()
    page_obj, other_params = paginate_queryset(request, offers_qs)

    context = {
        'page_title': 'Offers & Coupons',
        'active_nav': 'offers',
        'offers': page_obj,
        'page_obj': page_obj,
        'other_params': other_params,
    }
    return render(request, 'admin_dashboard/offers_list.html', context)


@owner_required
def dashboard_schedule(request):
    """
    Schedule & Calendar is now combined into the main Dashboard Overview.
    """
    return dashboard_overview(request)
