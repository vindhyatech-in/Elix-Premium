"""
bookings/notifications.py — in-app notification engine.

`notify_user(booking, ntype)` creates a UserNotification row for the
booking's customer. Called alongside send_booking_email_all() at every
status-change site so the bell badge stays in sync with email events.

Messages are kept here (not in models) so templates never have to import
Python code to look one up, and so adding a new event type is one dict
entry + one call site, not three file edits.
"""

import logging

logger = logging.getLogger(__name__)

# ntype → (title template, body template)
# Placeholders: {booking_number}, {beautician_name}, {date}, {slot}
_MESSAGES = {
    'booking_confirmed': (
        '🎉 Booking Confirmed!',
        'Your booking #{booking_number} has been confirmed. '
        'We will assign a beautician shortly.',
    ),
    'beautician_assigned': (
        '💅 Beautician Assigned',
        'Your beautician {beautician_name} has been assigned to booking '
        '#{booking_number}. Get ready for a great experience!',
    ),
    'booking_rescheduled': (
        '📅 Booking Rescheduled',
        'Your booking #{booking_number} has been rescheduled to {date} ({slot}).',
    ),
    'booking_cancelled': (
        '❌ Booking Cancelled',
        'Your booking #{booking_number} has been cancelled. '
        'If this was unexpected, please contact support.',
    ),
    'booking_completed': (
        '✅ Service Completed',
        'Your booking #{booking_number} is now complete. '
        'We hope you loved the experience! Please leave a review.',
    ),
    'on_the_way': (
        '🚗 Beautician On The Way',
        'Your beautician {beautician_name} is on the way for booking '
        '#{booking_number}. Please be ready!',
    ),
    'job_started': (
        '✂️ Service Started',
        'Your appointment for booking #{booking_number} has started. '
        'Sit back and enjoy the experience!',
    ),
}


def _build_context(booking):
    """Build the format-kwargs dict from a Booking instance."""
    beautician = booking.assigned_beautician
    beautician_name = (
        beautician.user.get_full_name() or beautician.user.username
        if beautician and beautician.user
        else 'your beautician'
    )
    slot_display = {
        'morning': 'Morning (8 AM – 12 PM)',
        'afternoon': 'Afternoon (12 PM – 4 PM)',
        'evening': 'Evening (4 PM – 8 PM)',
    }
    slot = slot_display.get(booking.time_slot, booking.time_slot or '')
    if booking.exact_time:
        slot = booking.exact_time.strftime('%I:%M %p')
    return {
        'booking_number': booking.booking_number,
        'beautician_name': beautician_name,
        'date': booking.scheduled_date.strftime('%d %b %Y') if booking.scheduled_date else '',
        'slot': slot,
    }


def notify_user(booking, ntype: str) -> None:
    """
    Create a UserNotification for the booking's customer.
    Safe to call from a background thread — imports models lazily to avoid
    circular imports (bookings/views.py → bookings/notifications.py →
    bookings/models.py is fine, but importing at module level can race
    Django's app registry in some setups).

    Swallows all exceptions so a notification failure never blocks the
    main request/thread that called it.
    """
    try:
        from .models import UserNotification  # lazy import — avoids circular ref

        if not booking or not booking.user_id:
            return

        title_tpl, body_tpl = _MESSAGES.get(ntype, ('🔔 Update', 'Your booking has been updated.'))
        ctx = _build_context(booking)

        UserNotification.objects.create(
            user_id=booking.user_id,
            booking=booking,
            ntype=ntype,
            title=title_tpl.format(**ctx),
            body=body_tpl.format(**ctx),
        )
    except Exception:
        logger.exception('notify_user failed — ntype=%s booking=%s', ntype, getattr(booking, 'booking_number', '?'))
