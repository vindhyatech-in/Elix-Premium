from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from accounts.models import Employee
from bookings.models import Booking


@login_required(login_url='account_login')
def employee_dashboard(request):
    """
    Employee / Beautician Dashboard: Mobile-first control panel for assigned jobs,
    schedule navigation, order status updates, payment collection, and duty status toggle.
    """
    user = request.user

    # Identify employee profile (either linked directly or match by email or staff preview)
    employee = None
    if hasattr(user, 'employee_profile'):
        employee = user.employee_profile
    elif user.email:
        employee = Employee.objects.filter(email__iexact=user.email).first()

    if not employee and user.is_staff:
        # Staff/Owner previewing the employee view
        emp_id = request.GET.get('emp_id')
        if emp_id:
            employee = Employee.objects.filter(id=emp_id).first()
        if not employee:
            employee = Employee.objects.first()

    if not employee and not user.is_staff:
        messages.error(request, 'You do not have an assigned Beautician profile.')
        return redirect('services_booking')

    # Handle POST Actions
    if request.method == 'POST':
        action = request.POST.get('action')

        if action == 'toggle_duty' and employee:
            new_status = 'on_leave' if employee.status == 'active' else 'active'
            employee.status = new_status
            employee.save()
            status_label = 'On Duty (Active)' if new_status == 'active' else 'Off Duty (On Leave)'
            messages.success(request, f'Your status is now {status_label}.')

        elif action == 'update_booking_status':
            booking_id = request.POST.get('booking_id')
            new_status = request.POST.get('status')
            booking = get_object_or_404(Booking, id=booking_id)

            if new_status in dict(Booking.STATUS_CHOICES):
                booking.status = new_status
                booking.save()
                messages.success(request, f'Order #{booking.booking_number} updated to {booking.get_status_display()}.')

        elif action == 'mark_paid':
            booking_id = request.POST.get('booking_id')
            booking = get_object_or_404(Booking, id=booking_id)
            booking.payment_status = 'paid'
            booking.save()
            messages.success(request, f'Order #{booking.booking_number} marked as Paid.')

        return redirect(request.get_full_path())

    # Get Assigned Bookings
    today_date = timezone.now().date()
    assigned_bookings = (
        Booking.objects.filter(assigned_beautician=employee)
        .select_related('user')
        .prefetch_related('items')
        if employee
        else Booking.objects.none()
    )

    today_bookings = assigned_bookings.filter(scheduled_date=today_date).exclude(status='cancelled')
    upcoming_bookings = assigned_bookings.filter(status__in=['upcoming', 'in_progress']).exclude(
        id__in=today_bookings.values_list('id', flat=True)
    )
    completed_bookings = assigned_bookings.filter(status='completed')

    # Metrics
    completed_count = completed_bookings.count()
    total_earnings = completed_bookings.aggregate(Sum('total_amount'))['total_amount__sum'] or 0

    context = {
        'page_title': 'Beautician Dashboard',
        'employee': employee,
        'today_bookings': today_bookings,
        'upcoming_bookings': upcoming_bookings,
        'completed_bookings': completed_bookings,
        'completed_count': completed_count,
        'total_earnings': total_earnings,
        'today_date': today_date,
        'all_employees': Employee.objects.all() if user.is_staff else None,
    }
    return render(request, 'employee_dashboard/emp_dashboard.html', context)
