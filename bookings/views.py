import json
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Avg, Count
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_time
from django.views.decorators.http import require_POST

from catalog.models import Service
from core import booking_data

from .models import Booking, BookingItem, Review

# Mirrors booking.js's COUPONS dict — an accepted small duplication rather
# than building a shared coupon API for three hardcoded codes. See
# developed.md "Catalog & Bookings models".
COUPON_RATES = {
    'GLAM10': Decimal('0.10'),
    'WEEKDAY15': Decimal('0.15'),
    'BUNDLE20': Decimal('0.20'),
}

# booking_drawer.js's data-payment-value uses hyphens; the model's choices
# use underscores (more conventional for a Python/DB field).
PAYMENT_METHOD_MAP = {
    'pay-now': 'pay_now',
    'pay-at-home': 'pay_at_home',
}


@require_POST
def create_booking(request):
    """
    Creates a real Booking + BookingItem rows from the booking drawer's
    final "Confirm Booking" step. Recomputes subtotal/discount/total
    server-side from real ServiceVariant prices — never trusts client-sent
    totals. The JS already gates opening the drawer behind
    window.__isAuthenticated, but this endpoint checks again (session could
    expire mid-flow) and returns JSON either way, since a redirect response
    (what @login_required would do) can't be handled by fetch() the same
    way an HTML page load can.
    """
    if not request.user.is_authenticated:
        return JsonResponse({'ok': False, 'error': 'Please sign in to complete your booking.', 'login_required': True}, status=401)

    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({'ok': False, 'error': 'Invalid request body.'}, status=400)

    address = payload.get('address') or {}
    cart = payload.get('cart') or []
    booking_type = payload.get('booking_type')
    payment_method = PAYMENT_METHOD_MAP.get(payload.get('payment_method'))

    if not address.get('text'):
        return JsonResponse({'ok': False, 'error': 'A saved address is required.'}, status=400)
    if not cart:
        return JsonResponse({'ok': False, 'error': 'Your cart is empty.'}, status=400)
    if booking_type not in ('regular', 'urgent'):
        return JsonResponse({'ok': False, 'error': 'Invalid booking type.'}, status=400)
    if not payment_method:
        return JsonResponse({'ok': False, 'error': 'Invalid payment method.'}, status=400)

    scheduled_date = parse_date(payload.get('date') or '')
    if not scheduled_date:
        return JsonResponse({'ok': False, 'error': 'Invalid date.'}, status=400)

    time_slot = payload.get('time_slot') or ''
    exact_time = parse_time(payload.get('exact_time') or '') if booking_type == 'urgent' else None
    if booking_type == 'regular' and time_slot not in ('morning', 'afternoon', 'evening'):
        return JsonResponse({'ok': False, 'error': 'Select a time slot.'}, status=400)
    if booking_type == 'urgent' and not exact_time:
        return JsonResponse({'ok': False, 'error': 'Select a time.'}, status=400)

    # Enforce strict 50-minute advance window for today's bookings
    now_dt = timezone.now()
    today_date = now_dt.date()
    min_allowed_time = (now_dt + timedelta(minutes=50)).time()

    if scheduled_date == today_date:
        if booking_type == 'urgent':
            if exact_time < min_allowed_time:
                return JsonResponse({'ok': False, 'error': 'Urgent bookings for today must be scheduled at least 50 minutes in advance.'}, status=400)
        elif booking_type == 'regular':
            slot_end_times = {
                'morning': parse_time('12:00:00'),
                'afternoon': parse_time('16:00:00'),
                'evening': parse_time('20:00:00'),
            }
            slot_end = slot_end_times.get(time_slot)
            if slot_end and min_allowed_time >= slot_end:
                return JsonResponse({'ok': False, 'error': f'The selected {time_slot} slot is no longer available for today. Please select a later slot or date.'}, status=400)

    # Resolve cart -> real ServiceVariant prices server-side. A line's
    # variantId (set once the quick-view variant picker exists — see
    # developed.md "Catalog & Bookings models") picks a specific
    # ServiceVariant; omitted/blank (packages, or a line added from the
    # marketing page, which has no picker) falls back to the service's
    # default variant, same as before variants were selectable.
    line_items = []
    subtotal = Decimal('0')
    for line in cart:
        slug = line.get('id')
        variant_id = line.get('variantId')
        try:
            qty = max(1, int(line.get('qty') or 1))
        except (TypeError, ValueError):
            return JsonResponse({'ok': False, 'error': 'Invalid cart quantity.'}, status=400)
        service = Service.objects.filter(slug=slug, is_active=True).first()
        if not service:
            return JsonResponse({'ok': False, 'error': f'"{slug}" is no longer available.'}, status=400)
        if variant_id:
            variant = service.variants.filter(id=variant_id, is_active=True).first()
        else:
            variant = service.default_variant
        if not variant:
            return JsonResponse({'ok': False, 'error': f'"{slug}" is no longer available.'}, status=400)
        line_items.append((variant, qty))
        subtotal += variant.price * qty

    coupon_code = (payload.get('coupon_code') or '').strip().upper()
    discount_rate = COUPON_RATES.get(coupon_code, Decimal('0'))
    try:
        discount_amount = (subtotal * discount_rate).quantize(Decimal('0.01'))
    except InvalidOperation:
        discount_amount = Decimal('0')
    total_amount = subtotal - discount_amount

    booking = Booking.objects.create(
        user=request.user,
        address_label=address.get('label') or 'Address',
        address_text=address.get('text'),
        address_pincode=address.get('pincode') or '',
        address_lat=address.get('lat'),
        address_lng=address.get('lng'),
        scheduled_date=scheduled_date,
        booking_type=booking_type,
        time_slot=time_slot if booking_type == 'regular' else '',
        exact_time=exact_time if booking_type == 'urgent' else None,
        payment_method=payment_method,
        payment_status='paid' if payment_method == 'pay_now' else 'pending',
        subtotal=subtotal,
        discount_amount=discount_amount,
        total_amount=total_amount,
        coupon_code=coupon_code if discount_rate else '',
    )
    BookingItem.objects.bulk_create([
        BookingItem(
            booking=booking,
            service_variant=variant,
            name_snapshot=f'{variant.service.name} — {variant.label}' if variant.label else variant.service.name,
            price_snapshot=variant.price,
            duration_snapshot=variant.duration_mins,
            quantity=qty,
        )
        for variant, qty in line_items
    ])

    return JsonResponse({'ok': True, 'booking_number': booking.booking_number})


@login_required
def bookings_dashboard(request):
    """
    Phase 3's "bookings dashboard" from developed.md's roadmap — lists the
    signed-in user's own bookings (upcoming/completed/cancelled, filterable
    client-side same as the catalog's Type pills) with a "Rebook" action
    per booking.

    Rebook re-adds a past booking's items to the cart client-side (see
    bookings_dashboard.js) rather than a server endpoint — it's the exact
    same {id, variantId, qty} shape booking.js's cart already uses, so no
    new persistence is needed. Each booking's rebookable items (only those
    whose ServiceVariant/Service still exist and are active — a booking
    can reference a since-deactivated variant via service_variant=NULL,
    see BookingItem.service_variant's on_delete=SET_NULL) are attached as
    a plain Python attribute for the template to serialize per-booking via
    json_script, keyed by booking_number.
    """
    bookings = list(
        request.user.bookings
        .prefetch_related('items__service_variant__service', 'items__review')
        .all()
    )
    for booking in bookings:
        booking.rebook_items = [
            {'id': item.service_variant.service.slug, 'variantId': item.service_variant.id, 'qty': item.quantity}
            for item in booking.items.all()
            if item.service_variant and item.service_variant.is_active and item.service_variant.service.is_active
        ]

    # Same shared context services_booking() passes — app_navbar.html (its
    # Categories/Offers dropdowns, notification badge) and the floating
    # cart/chat panel this page also includes all expect it, and reusing
    # get_booking_catalog() here is what keeps the cart mini-panel able to
    # actually render item names/prices on this page instead of silently
    # dropping every line (see getCatalog() in booking.js — it degrades to
    # an empty catalog, not an error, when #catalog-data isn't on the page).
    context = {
        'booking_categories': booking_data.get_booking_categories(),
        'booking_offers': booking_data.get_booking_offers(),
        'booking_catalog': booking_data.get_booking_catalog(),
        'notifications': booking_data.get_notifications_mock(),
        'bookings': bookings,
    }
    return render(request, 'booking/pages/bookings_dashboard.html', context)


@login_required
@require_POST
def cancel_booking(request, booking_number):
    """
    Cancels a booking — only allowed while `Booking.can_cancel` is True
    (status still 'upcoming' AND more than CANCELLATION_CUTOFF (3h) before
    its scheduled_start; see bookings/models.py). Re-checked here even
    though the dashboard template only renders the Cancel button when
    `can_cancel` was true at page-render time — that snapshot can go stale
    if the user leaves the tab open past the cutoff before clicking it.

    `get_object_or_404(..., user=request.user)` doubles as the ownership
    check — a 404 (not a 403) for someone else's booking_number, so this
    endpoint never confirms/denies whether a given booking_number exists.
    """
    booking = get_object_or_404(Booking, booking_number=booking_number, user=request.user)
    if booking.can_cancel:
        booking.status = 'cancelled'
        booking.save(update_fields=['status', 'updated_at'])
        messages.success(request, f'Booking {booking.booking_number} has been cancelled.')
    else:
        messages.error(request, 'This booking can no longer be cancelled — either it’s already completed/cancelled, or it starts within 3 hours.')
    return redirect('bookings_dashboard')


@login_required
@require_POST
def submit_review(request, item_id):
    """
    Rates + reviews one completed booking's service — only reachable from
    the "Completed" tab of the bookings dashboard (see
    bookings_dashboard.html). `get_object_or_404(..., booking__user=...)`
    doubles as the ownership check, same 404-not-403 pattern as
    cancel_booking above.

    Recomputes the Service's aggregate `rating`/`reviews_count` from real
    Review rows on every submission, replacing whatever mock values it was
    seeded with — see catalog/models.py.
    """
    item = get_object_or_404(BookingItem, id=item_id, booking__user=request.user, booking__status='completed')

    if hasattr(item, 'review'):
        messages.error(request, 'You already reviewed this service.')
        return redirect('bookings_dashboard')

    if not item.service_variant:
        messages.error(request, 'This service is no longer available to review.')
        return redirect('bookings_dashboard')

    try:
        rating = int(request.POST.get('rating', ''))
    except ValueError:
        rating = 0
    if rating not in range(1, 6):
        messages.error(request, 'Please select a rating from 1 to 5 stars.')
        return redirect('bookings_dashboard')

    service = item.service_variant.service
    Review.objects.create(
        booking_item=item, user=request.user, service=service,
        rating=rating, comment=request.POST.get('comment', '').strip(),
    )

    agg = service.reviews.aggregate(avg=Avg('rating'), count=Count('id'))
    service.rating = round(agg['avg'] or 0, 1)
    service.reviews_count = agg['count'] or 0
    service.save(update_fields=['rating', 'reviews_count'])

    messages.success(request, 'Thanks for your review!')
    return redirect('bookings_dashboard')
