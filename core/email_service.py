"""
core/email_service.py — Centralised transactional email for the Elix platform.

ALL booking-lifecycle emails (customer, admin, beautician) are sent through
send_booking_email().  Nothing in this module touches the request/response
cycle directly — callers fire-and-forget from their view and this module
dispatches in a daemon thread so the HTTP response is never delayed by a slow
SMTP/API round-trip.

Usage:
    from core.email_service import send_booking_email
    send_booking_email('booking_confirmed', booking, recipient='customer')

Template resolution:
    templates/emails/<event>.html   (HTML body — required)
    templates/emails/<event>.txt    (plain-text fallback — optional but recommended)

The subject line for every event is defined in EMAIL_SUBJECTS below — override
per-environment by sub-classing or monkey-patching if needed.
"""

import logging
import threading
from typing import Literal

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)

# ── Subject lines ──────────────────────────────────────────────────────────────

EMAIL_SUBJECTS = {
    # Customer emails
    'booking_confirmed':    '[Elix] Your booking is confirmed — {booking_number}',
    'booking_rescheduled':  '[Elix] Your booking has been rescheduled — {booking_number}',
    'booking_cancelled':    '[Elix] Your booking has been cancelled — {booking_number}',
    'beautician_assigned':  '[Elix] Your beautician has been assigned — {booking_number}',
    'booking_completed':    '[Elix] Service completed — receipt for {booking_number}',

    # Admin emails
    'admin_new_booking':        '[Elix] New booking received — {booking_number}',
    'admin_booking_cancelled':  '[Elix] Booking cancelled — {booking_number}',
    'admin_booking_rescheduled':'[Elix] Booking rescheduled — {booking_number}',
    'admin_booking_completed':  '[Elix] Booking completed — {booking_number}',

    # Beautician emails
    'beautician_assigned_job':      '[Elix] New job assigned — {booking_number}',
    'beautician_job_rescheduled':   '[Elix] Job rescheduled — {booking_number}',
    'beautician_job_cancelled':     '[Elix] Job cancelled — {booking_number}',
    'beautician_job_completed':     '[Elix] Job completed — {booking_number}',
}

RecipientType = Literal['customer', 'admin', 'beautician']


def _build_context(booking) -> dict:
    """
    Common template context available to every email template.
    Booking items and assigned beautician are pre-fetched here once so
    templates don't trigger extra queries.
    """
    items = list(booking.items.select_related('service_variant', 'package').all())
    beautician = getattr(booking, 'assigned_beautician', None)

    slot_labels = {
        'morning':   'Morning (8 AM – 12 PM)',
        'afternoon': 'Afternoon (12 PM – 4 PM)',
        'evening':   'Evening (4 PM – 8 PM)',
    }
    if booking.booking_type == 'urgent' and booking.exact_time:
        time_display = booking.exact_time.strftime('%-I:%M %p') + ' (Urgent Express)'
    else:
        time_display = slot_labels.get(booking.time_slot, booking.time_slot or '—')

    return {
        'booking':       booking,
        'items':         items,
        'beautician':    beautician,
        'time_display':  time_display,
        'site_name':     settings.SITE_NAME,
        'site_email':    settings.SITE_EMAIL,
        'site_phone':    getattr(settings, 'SITE_PHONE', ''),
        'site_url':      getattr(settings, 'SITE_URL', ''),
    }


def _dispatch(event: str, recipient_email: str, subject: str, context: dict) -> None:
    """
    Renders templates/emails/<event>.html (+ optional .txt fallback),
    then sends via Django's configured EMAIL_BACKEND.
    Called exclusively from a daemon thread — never from the main thread.
    """
    html_template = f'emails/{event}.html'
    txt_template  = f'emails/{event}.txt'

    try:
        html_body = render_to_string(html_template, context)
    except Exception:
        logger.exception('Email template render failed: %s', html_template)
        return

    try:
        txt_body = render_to_string(txt_template, context)
    except Exception:
        # Plain-text fallback is optional — degrade gracefully if missing
        txt_body = f'{subject}\n\nPlease view this email in an HTML-capable client.'

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=txt_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient_email],
        )
        msg.attach_alternative(html_body, 'text/html')
        msg.send(fail_silently=False)
        logger.info('Email sent: event=%s to=%s subject=%r', event, recipient_email, subject)
    except Exception:
        logger.exception(
            'Email send failed: event=%s to=%s subject=%r', event, recipient_email, subject
        )


def send_booking_email(
    event: str,
    booking,
    recipient: RecipientType = 'customer',
    extra_context: dict | None = None,
) -> None:
    """
    Public API — fire-and-forget transactional email.

    Args:
        event:          Key from EMAIL_SUBJECTS, e.g. 'booking_confirmed'.
        booking:        A Booking model instance.
        recipient:      'customer' | 'admin' | 'beautician'
        extra_context:  Any additional template variables to merge in.

    The email is dispatched in a daemon thread so the caller's request
    thread returns immediately regardless of SMTP/API latency.
    """
    # Resolve recipient address
    if recipient == 'customer':
        email = getattr(booking.user, 'email', None)
    elif recipient == 'admin':
        email = settings.SITE_EMAIL
    elif recipient == 'beautician':
        beautician = getattr(booking, 'assigned_beautician', None)
        email = getattr(beautician, 'email', None) if beautician else None
    else:
        logger.warning('send_booking_email: unknown recipient type %r', recipient)
        return

    if not email:
        logger.debug(
            'send_booking_email: skipped event=%s recipient=%s — no email address',
            event, recipient,
        )
        return

    subject_tpl = EMAIL_SUBJECTS.get(event, '[Elix] Booking update — {booking_number}')
    subject = subject_tpl.format(booking_number=booking.booking_number)

    context = _build_context(booking)
    if extra_context:
        context.update(extra_context)

    t = threading.Thread(
        target=_dispatch,
        args=(event, email, subject, context),
        daemon=True,   # dies with the main process — no zombie threads
        name=f'email-{event}-{booking.booking_number}',
    )
    t.start()


def send_booking_email_all(
    event_customer: str | None,
    event_admin: str | None,
    event_beautician: str | None,
    booking,
    extra_context: dict | None = None,
) -> None:
    """
    Convenience helper that fires all three recipient emails for a single
    lifecycle event in one call.  Pass None to skip a recipient.

    Example:
        send_booking_email_all(
            event_customer='booking_confirmed',
            event_admin='admin_new_booking',
            event_beautician=None,
            booking=booking,
        )
    """
    if event_customer:
        send_booking_email(event_customer, booking, 'customer', extra_context)
    if event_admin:
        send_booking_email(event_admin, booking, 'admin', extra_context)
    if event_beautician:
        send_booking_email(event_beautician, booking, 'beautician', extra_context)
