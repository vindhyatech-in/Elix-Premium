import json
from decimal import Decimal, InvalidOperation

from django.http import JsonResponse
from django.utils.dateparse import parse_date, parse_time
from django.views.decorators.http import require_POST

from catalog.models import Service

from .models import Booking, BookingItem

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

    # Resolve cart -> real ServiceVariant prices server-side.
    line_items = []
    subtotal = Decimal('0')
    for line in cart:
        slug = line.get('id')
        try:
            qty = max(1, int(line.get('qty') or 1))
        except (TypeError, ValueError):
            return JsonResponse({'ok': False, 'error': 'Invalid cart quantity.'}, status=400)
        service = Service.objects.filter(slug=slug, is_active=True).first()
        variant = service.default_variant if service else None
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
        exact_time=exact_time,
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
            name_snapshot=variant.service.name,
            price_snapshot=variant.price,
            duration_snapshot=variant.duration_mins,
            quantity=qty,
        )
        for variant, qty in line_items
    ])

    return JsonResponse({'ok': True, 'booking_number': booking.booking_number})
