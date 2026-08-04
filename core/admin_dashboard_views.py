from django.contrib import messages
from django.contrib.admin.views.decorators import staff_member_required
from django.db import transaction
from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404, redirect, render

from accounts.models import Employee
from bookings.models import Booking
from catalog.models import Category, Service, ServiceVariant


@staff_member_required(login_url='account_login')
def dashboard_overview(request):
    """
    Main overview page for the owner/admin dashboard: KPI metrics,
    order status breakdown, revenue calculation, and recent activity.
    """
    total_bookings = Booking.objects.count()
    completed_bookings = Booking.objects.filter(status='completed')
    total_revenue = completed_bookings.aggregate(Sum('total_amount'))['total_amount__sum'] or 0

    upcoming_count = Booking.objects.filter(status='upcoming').count()
    in_progress_count = Booking.objects.filter(status='in_progress').count()
    completed_count = completed_bookings.count()
    cancelled_count = Booking.objects.filter(status='cancelled').count()

    active_services_count = Service.objects.filter(is_active=True).count()
    total_services_count = Service.objects.count()

    active_staff_count = Employee.objects.filter(status='active').count()
    total_staff_count = Employee.objects.count()

    recent_bookings = (
        Booking.objects.select_related('user', 'assigned_beautician')
        .prefetch_related('items')[:6]
    )

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
    }
    return render(request, 'admin_dashboard/overview.html', context)


@staff_member_required(login_url='account_login')
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
        bookings_qs = bookings_qs.filter(scheduled_date=date_filter)

    if request.method == 'POST':
        action = request.POST.get('action')
        booking_id = request.POST.get('booking_id')
        booking = get_object_or_404(Booking, id=booking_id)

        if action == 'update_status':
            new_status = request.POST.get('status')
            new_payment = request.POST.get('payment_status')
            if new_status in dict(Booking.STATUS_CHOICES):
                booking.status = new_status
            if new_payment in dict(Booking.PAYMENT_STATUS_CHOICES):
                booking.payment_status = new_payment
            booking.save()
            messages.success(request, f'Order #{booking.booking_number} status updated to {booking.get_status_display()}.')

        elif action == 'assign_beautician':
            beautician_id = request.POST.get('beautician_id')
            if beautician_id:
                beautician = get_object_or_404(Employee, id=beautician_id)
                booking.assigned_beautician = beautician
                messages.success(request, f'Assigned {beautician.name} to Order #{booking.booking_number}.')
            else:
                booking.assigned_beautician = None
                messages.info(request, f'Unassigned beautician from Order #{booking.booking_number}.')
            booking.save()

        return redirect(request.get_full_path())

    employees = Employee.objects.all()

    context = {
        'page_title': 'Booking & Order Management',
        'active_nav': 'bookings',
        'bookings': bookings_qs,
        'employees': employees,
        'status_filter': status_filter,
        'search_query': search_query,
        'date_filter': date_filter,
        'status_choices': Booking.STATUS_CHOICES,
        'payment_status_choices': Booking.PAYMENT_STATUS_CHOICES,
    }
    return render(request, 'admin_dashboard/bookings_list.html', context)


@staff_member_required(login_url='account_login')
def dashboard_services(request):
    """
    Catalog & Service management page: edit service info, manage variants,
    add services with multiple variants, delete services, and toggle active status.
    """
    category_slug = request.GET.get('category', 'all')
    search_query = request.GET.get('q', '').strip()

    services_qs = Service.objects.select_related('category').prefetch_related('variants')

    if category_slug != 'all':
        services_qs = services_qs.filter(category__slug=category_slug)

    if search_query:
        services_qs = services_qs.filter(
            Q(name__icontains=search_query) | Q(description__icontains=search_query) | Q(slug__icontains=search_query)
        )

    if request.method == 'POST':
        action = request.POST.get('action')

        if action == 'toggle_service':
            service_id = request.POST.get('service_id')
            service = get_object_or_404(Service, id=service_id)
            service.is_active = not service.is_active
            service.save()
            status_str = 'enabled' if service.is_active else 'disabled'
            messages.success(request, f'Service "{service.name}" has been {status_str}.')

        elif action == 'delete_service':
            service_id = request.POST.get('service_id')
            service = get_object_or_404(Service, id=service_id)
            name = service.name
            service.delete()
            messages.success(request, f'Service "{name}" deleted successfully.')

        elif action == 'edit_service':
            service_id = request.POST.get('service_id')
            service = get_object_or_404(Service, id=service_id)
            name = request.POST.get('name', '').strip()
            category_id = request.POST.get('category_id')
            kind = request.POST.get('kind', 'service')
            description = request.POST.get('description', '').strip()
            badges_str = request.POST.get('badges', '').strip()

            if name and category_id:
                category = get_object_or_404(Category, id=category_id)
                service.name = name
                service.category = category
                service.kind = kind
                service.description = description
                if badges_str:
                    service.badges = [b.strip() for b in badges_str.split(',') if b.strip()]
                else:
                    service.badges = []
                service.save()
                messages.success(request, f'Updated service details for "{name}".')

        elif action == 'add_service':
            name = request.POST.get('name', '').strip()
            category_id = request.POST.get('category_id')
            kind = request.POST.get('kind', 'service')
            description = request.POST.get('description', '').strip()
            badges_str = request.POST.get('badges', '').strip()

            variant_labels = request.POST.getlist('variant_label')
            variant_prices = request.POST.getlist('variant_price')
            variant_mrps = request.POST.getlist('variant_mrp')
            variant_durations = request.POST.getlist('variant_duration')

            if name and category_id and variant_prices:
                category = get_object_or_404(Category, id=category_id)
                slug = name.lower().replace(' ', '-').replace('/', '-').replace(':', '')
                base_slug = slug
                counter = 1
                while Service.objects.filter(slug=slug).exists():
                    slug = f'{base_slug}-{counter}'
                    counter += 1

                badges = [b.strip() for b in badges_str.split(',') if b.strip()] if badges_str else []

                with transaction.atomic():
                    service = Service.objects.create(
                        name=name,
                        slug=slug,
                        category=category,
                        kind=kind,
                        description=description,
                        photo='images/portfolio-1.jpg',
                        tone='espresso',
                        badges=badges,
                        is_active=True,
                    )

                    created_count = 0
                    for idx in range(len(variant_prices)):
                        p_val = variant_prices[idx]
                        if not p_val:
                            continue
                        lbl = variant_labels[idx].strip() if idx < len(variant_labels) else ''
                        mrp_val = variant_mrps[idx] if idx < len(variant_mrps) and variant_mrps[idx] else None
                        dur_val = int(variant_durations[idx]) if idx < len(variant_durations) and variant_durations[idx] else 30

                        ServiceVariant.objects.create(
                            service=service,
                            label=lbl,
                            duration_mins=dur_val,
                            price=float(p_val),
                            mrp=float(mrp_val) if mrp_val else None,
                            is_default=(created_count == 0),
                            is_active=True,
                            sort_order=created_count,
                        )
                        created_count += 1

                messages.success(request, f'Created new service "{name}" with {created_count} variant(s).')

        elif action == 'add_variant':
            service_id = request.POST.get('service_id')
            service = get_object_or_404(Service, id=service_id)
            label = request.POST.get('label', '').strip()
            price = request.POST.get('price')
            mrp = request.POST.get('mrp')
            duration = request.POST.get('duration_mins', 30)
            is_default = request.POST.get('is_default') in ['on', 'true', '1']

            if price:
                with transaction.atomic():
                    if is_default:
                        service.variants.update(is_default=False)
                    ServiceVariant.objects.create(
                        service=service,
                        label=label,
                        duration_mins=int(duration),
                        price=float(price),
                        mrp=float(mrp) if mrp else None,
                        is_default=is_default or not service.variants.exists(),
                        is_active=True,
                    )
                messages.success(request, f'Added variant "{label or "Standard"}" to "{service.name}".')

        elif action == 'update_variant_price':
            variant_id = request.POST.get('variant_id')
            variant = get_object_or_404(ServiceVariant, id=variant_id)
            label = request.POST.get('label', '').strip()
            price = request.POST.get('price')
            mrp = request.POST.get('mrp')
            duration = request.POST.get('duration_mins')
            is_default = request.POST.get('is_default') in ['on', 'true', '1']

            if price:
                variant.label = label
                variant.price = float(price)
                variant.mrp = float(mrp) if mrp and float(mrp) > 0 else None
                if duration:
                    variant.duration_mins = int(duration)

                if is_default and not variant.is_default:
                    variant.service.variants.update(is_default=False)
                    variant.is_default = True

                variant.save()
                messages.success(request, f'Updated variant details for "{variant.service.name}".')

        elif action == 'delete_variant':
            variant_id = request.POST.get('variant_id')
            variant = get_object_or_404(ServiceVariant, id=variant_id)
            service = variant.service
            if service.variants.count() <= 1:
                messages.error(request, 'Cannot delete the only variant of a service. Delete the entire service instead.')
            else:
                variant.delete()
                if not service.variants.filter(is_default=True).exists():
                    first_var = service.variants.first()
                    if first_var:
                        first_var.is_default = True
                        first_var.save()
                messages.success(request, f'Deleted variant from "{service.name}".')

        return redirect(request.get_full_path())

    categories = Category.objects.all()

    context = {
        'page_title': 'Service Catalog Management',
        'active_nav': 'services',
        'services': services_qs,
        'categories': categories,
        'category_slug': category_slug,
        'search_query': search_query,
    }
    return render(request, 'admin_dashboard/services_list.html', context)


@staff_member_required(login_url='account_login')
def dashboard_employees(request):
    """
    Employee / Beautician management page: list employees, add staff,
    edit experience/specialties, and toggle active/leave status.
    """
    if request.method == 'POST':
        action = request.POST.get('action')

        if action == 'add_employee':
            name = request.POST.get('name', '').strip()
            phone = request.POST.get('phone', '').strip()
            email = request.POST.get('email', '').strip()
            specialties = request.POST.get('specialties', '').strip()
            experience_years = request.POST.get('experience_years', 1)
            status = request.POST.get('status', 'active')

            if name and phone:
                Employee.objects.create(
                    name=name,
                    phone=phone,
                    email=email,
                    specialties=specialties or 'General Beauty',
                    experience_years=int(experience_years),
                    status=status,
                )
                messages.success(request, f'Employee "{name}" added successfully.')

        elif action == 'update_employee':
            employee_id = request.POST.get('employee_id')
            employee = get_object_or_404(Employee, id=employee_id)

            employee.name = request.POST.get('name', employee.name).strip()
            employee.phone = request.POST.get('phone', employee.phone).strip()
            employee.email = request.POST.get('email', employee.email).strip()
            employee.specialties = request.POST.get('specialties', employee.specialties).strip()
            employee.status = request.POST.get('status', employee.status)
            exp = request.POST.get('experience_years')
            if exp:
                employee.experience_years = int(exp)
            employee.save()
            messages.success(request, f'Updated employee "{employee.name}".')

        elif action == 'toggle_status':
            employee_id = request.POST.get('employee_id')
            employee = get_object_or_404(Employee, id=employee_id)
            new_status = 'on_leave' if employee.status == 'active' else 'active'
            employee.status = new_status
            employee.save()
            messages.success(request, f'Status for "{employee.name}" updated to {employee.get_status_display()}.')

        return redirect(request.get_full_path())

    employees_qs = Employee.objects.prefetch_related('assigned_bookings').all()

    context = {
        'page_title': 'Employee & Staff Management',
        'active_nav': 'employees',
        'employees': employees_qs,
        'status_choices': Employee.STATUS_CHOICES,
    }
    return render(request, 'admin_dashboard/employees_list.html', context)
