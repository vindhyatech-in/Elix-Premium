import json
import logging
from datetime import timedelta

from django import forms
from django.contrib.auth import authenticate
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_time
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods, require_POST

from accounts.fields import IndianPhoneField
from accounts.models import Address, Profile
from bookings.models import Booking, BookingItem
from bookings.views import PAYMENT_METHOD_MAP, CartError, _resolve_cart_pricing
from catalog.models import Category
from core import booking_data

from .auth import token_required
from .models import AuthToken

logger = logging.getLogger(__name__)

INDORE_PINCODES = {
    '452001', '452002', '452003', '452004', '452005', '452006', '452007',
    '452008', '452009', '452010', '452011', '452012', '452013', '452014',
    '452015', '452016', '452018', '452020', '453771'
}


def verify_serviceability(request):
    """Check if location pincode is within serviceable area (Indore, MP)."""
    pincode = request.GET.get('pincode', '').strip()
    city = request.GET.get('city', '').strip().lower()

    is_serviceable = (pincode in INDORE_PINCODES) or ('indore' in city)

    return JsonResponse({
        'status': 'success',
        'city': 'Indore',
        'pincode': pincode,
        'is_serviceable': is_serviceable,
        'urgent_service_available': is_serviceable,
        'urgent_eta_minutes': 50 if is_serviceable else None,
        'message': 'Serviceable in Indore, MP! Urgent 50-min service available.' if is_serviceable else 'Sorry, currently we only service inside Indore, MP.'
    })


def get_categories(request):
    """Get active catalog categories."""
    categories = Category.objects.all().values('id', 'slug', 'name')
    return JsonResponse({'status': 'success', 'categories': list(categories)})


def catalog_view(request):
    """Unified service+package catalog — wraps
    core.booking_data.get_booking_catalog(), the exact same data the web
    catalog cards (templates/booking/components/catalog_card.html)
    render from, so mobile and web can never drift into two different
    shapes for "what's in the catalog". Replaces the old get_services
    (removed — it queried ServiceVariant.duration_minutes, a field that
    doesn't exist; the real field is duration_mins, so every call 500'd;
    see AUDIT_FINDINGS.md #6) rather than patching a shape nothing else
    should keep consuming. Optional ?kind=service|package filter."""
    items = booking_data.get_booking_catalog()
    kind = request.GET.get('kind')
    if kind in ('service', 'package'):
        items = [item for item in items if item.get('kind') == kind]
    return JsonResponse({'status': 'success', 'catalog': items})


def offers_view(request):
    """Active coupon codes — GET /api/v1/offers/."""
    return JsonResponse({'status': 'success', 'offers': booking_data.get_booking_offers()})


@csrf_exempt
@require_POST
def auth_login(request):
    """POST /api/v1/auth/login/ — {identifier, password}. `identifier` can
    be a username or email: authenticate() already resolves either,
    since AUTHENTICATION_BACKENDS includes allauth's own backend (see
    GlamourAtHome/settings.py), which supports email-based lookup on top
    of Django's default username-only ModelBackend. Returns a bearer
    token the mobile app attaches to every subsequent request instead of
    a session cookie (see api/auth.py::token_required)."""
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({'ok': False, 'error': 'Invalid request body.'}, status=400)

    identifier = (payload.get('identifier') or '').strip()
    password = payload.get('password') or ''
    if not identifier or not password:
        return JsonResponse({'ok': False, 'error': 'Enter your email/username and password.'}, status=400)

    user = authenticate(request, username=identifier, password=password)
    if not user:
        return JsonResponse({'ok': False, 'error': 'Incorrect email/username or password.'}, status=400)
    if not user.is_active:
        return JsonResponse({'ok': False, 'error': 'This account has been disabled.'}, status=400)

    token, _ = AuthToken.objects.get_or_create(user=user)
    return JsonResponse({
        'ok': True,
        'token': token.key,
        'user': {
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
        },
    })


@csrf_exempt
@require_POST
@token_required
def auth_logout(request):
    """POST /api/v1/auth/logout/ — drops the caller's token so it can no
    longer authenticate any further request."""
    AuthToken.objects.filter(user=request.user).delete()
    return JsonResponse({'ok': True})


@csrf_exempt
@token_required
@require_http_methods(['GET', 'POST'])
def profile_view(request):
    """GET/POST /api/v1/profile/ — same fields/validation as
    accounts/views.py::profile_view (name + phone, with the same
    IndianPhoneField normalization and cross-account uniqueness check),
    JSON in/out instead of a rendered template."""
    profile, _ = Profile.objects.get_or_create(user=request.user)

    if request.method == 'GET':
        return JsonResponse({
            'ok': True,
            'user': {
                'email': request.user.email,
                'first_name': request.user.first_name,
                'last_name': request.user.last_name,
            },
            'phone': profile.phone,
        })

    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({'ok': False, 'error': 'Invalid request body.'}, status=400)

    first_name = (payload.get('first_name') or '').strip()[:150]
    last_name = (payload.get('last_name') or '').strip()[:150]
    phone = (payload.get('phone') or '').strip()[:20]

    if phone:
        try:
            phone = IndianPhoneField(required=False).clean(phone)
        except forms.ValidationError:
            return JsonResponse({'ok': False, 'error': 'Enter a valid phone number.'}, status=400)
    if phone and Profile.objects.filter(phone=phone).exclude(user=request.user).exists():
        return JsonResponse({'ok': False, 'error': 'That phone number is already registered to another account.'}, status=400)

    request.user.first_name = first_name
    request.user.last_name = last_name
    request.user.save(update_fields=['first_name', 'last_name'])
    profile.phone = phone
    profile.save(update_fields=['phone'])

    return JsonResponse({'ok': True})


@csrf_exempt
@token_required
@require_http_methods(['GET', 'POST'])
def addresses_view(request):
    """GET/POST /api/v1/addresses/ — same shape/validation as
    accounts/views.py::addresses_api, keyed off the token-resolved user
    instead of a session."""
    if request.method == 'GET':
        addresses = list(request.user.addresses.values('id', 'label', 'text', 'pincode', 'lat', 'lng'))
        return JsonResponse({'ok': True, 'addresses': addresses})

    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({'ok': False, 'error': 'Invalid request body.'}, status=400)

    text = (payload.get('text') or '').strip()
    if not text:
        return JsonResponse({'ok': False, 'error': 'Enter your full address.'}, status=400)

    pincode = (payload.get('pincode') or '').strip()
    if pincode and not (pincode.isdigit() and len(pincode) == 6):
        return JsonResponse({'ok': False, 'error': 'Enter a valid 6-digit pincode.'}, status=400)

    lat, lng = payload.get('lat'), payload.get('lng')
    try:
        lat = float(lat) if lat is not None else None
        lng = float(lng) if lng is not None else None
    except (TypeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Invalid map coordinates.'}, status=400)

    address = Address.objects.create(
        user=request.user,
        label=(payload.get('label') or '').strip()[:60] or 'Address',
        text=text,
        pincode=pincode,
        lat=lat,
        lng=lng,
    )
    return JsonResponse({'ok': True, 'address': {
        'id': address.id, 'label': address.label, 'text': address.text,
        'pincode': address.pincode, 'lat': address.lat, 'lng': address.lng,
    }})


@csrf_exempt
@token_required
@require_http_methods(['DELETE'])
def address_delete_view(request, address_id):
    """DELETE /api/v1/addresses/<id>/ — get_object_or_404(..., user=...)
    doubles as the ownership check, same pattern as the web's
    accounts/views.py::address_delete."""
    address = get_object_or_404(Address, id=address_id, user=request.user)
    address.delete()
    return JsonResponse({'ok': True})


@token_required
@require_http_methods(['GET'])
def bookings_view(request):
    """GET /api/v1/bookings/ — the signed-in user's own bookings, same
    query as bookings/views.py::bookings_dashboard, JSON instead of a
    rendered template."""
    bookings = (
        request.user.bookings
        .prefetch_related('items__service_variant__service', 'items__package')
        .all()
    )
    data = []
    for booking in bookings:
        items = [
            {
                'name': item.name_snapshot,
                'price': float(item.price_snapshot),
                'quantity': item.quantity,
                'included': item.included_snapshot,
            }
            for item in booking.items.all()
        ]
        data.append({
            'booking_number': booking.booking_number,
            'status': booking.status,
            'status_display': booking.get_status_display(),
            'scheduled_date': booking.scheduled_date.isoformat(),
            'booking_type': booking.booking_type,
            'time_slot': booking.time_slot,
            'time_slot_display': booking.get_time_slot_display() if booking.time_slot else None,
            'exact_time': booking.exact_time.strftime('%H:%M') if booking.exact_time else None,
            'address_label': booking.address_label,
            'address_text': booking.address_text,
            'payment_method': booking.payment_method,
            'payment_status': booking.payment_status,
            'subtotal': float(booking.subtotal),
            'discount_amount': float(booking.discount_amount),
            'total_amount': float(booking.total_amount),
            'can_cancel': booking.can_cancel,
            'start_otp': booking.start_otp if booking.status == 'on_the_way' and not booking.otp_verified_at else None,
            'items': items,
        })
    return JsonResponse({'ok': True, 'bookings': data})


@csrf_exempt
@token_required
@require_POST
def booking_cancel_view(request, booking_number):
    """POST /api/v1/bookings/<booking_number>/cancel/ — same can_cancel
    gate as bookings/views.py::cancel_booking."""
    booking = get_object_or_404(Booking, booking_number=booking_number, user=request.user)
    if not booking.can_cancel:
        return JsonResponse({'ok': False, 'error': 'This booking can no longer be cancelled — the beautician is already on the way or it’s completed/cancelled.'}, status=400)
    booking.status = 'cancelled'
    booking.save(update_fields=['status', 'updated_at'])
    return JsonResponse({'ok': True})


@csrf_exempt
@token_required
@require_POST
def checkout_view(request):
    """POST /api/v1/bookings/checkout/ — mobile v1 only supports
    payment_method='pay_at_home' (no in-app Razorpay integration yet,
    that's a native-SDK follow-up, not UI work). Reuses
    bookings.views._resolve_cart_pricing for server-side pricing — the
    amount charged must never be computed twice, once here and once for
    the web checkout, in two different ways."""
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({'ok': False, 'error': 'Invalid request body.'}, status=400)

    address = payload.get('address') or {}
    cart = payload.get('cart') or []
    booking_type = payload.get('booking_type')
    payment_method = PAYMENT_METHOD_MAP.get(payload.get('payment_method'))

    if payment_method != 'pay_at_home':
        return JsonResponse({'ok': False, 'error': 'Only Pay At Home is supported from the app right now.'}, status=400)
    if not address.get('text'):
        return JsonResponse({'ok': False, 'error': 'A saved address is required.'}, status=400)

    try:
        address_lat = float(address['lat']) if address.get('lat') is not None else None
        address_lng = float(address['lng']) if address.get('lng') is not None else None
    except (TypeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Invalid address coordinates.'}, status=400)
    if booking_type not in ('regular', 'urgent'):
        return JsonResponse({'ok': False, 'error': 'Invalid booking type.'}, status=400)

    scheduled_date = parse_date(payload.get('date') or '')
    if not scheduled_date:
        return JsonResponse({'ok': False, 'error': 'Invalid date.'}, status=400)
    if scheduled_date < timezone.now().date():
        return JsonResponse({'ok': False, 'error': 'Scheduled date cannot be in the past.'}, status=400)

    time_slot = payload.get('time_slot') or ''
    exact_time = parse_time(payload.get('exact_time') or '') if booking_type == 'urgent' else None
    if booking_type == 'regular' and time_slot not in ('morning', 'afternoon', 'evening'):
        return JsonResponse({'ok': False, 'error': 'Select a time slot.'}, status=400)
    if booking_type == 'urgent' and not exact_time:
        return JsonResponse({'ok': False, 'error': 'Select a time.'}, status=400)

    now_dt = timezone.now()
    today_date = now_dt.date()
    min_allowed_time = (now_dt + timedelta(minutes=50)).time()
    if scheduled_date == today_date:
        if booking_type == 'urgent' and exact_time < min_allowed_time:
            return JsonResponse({'ok': False, 'error': 'Urgent bookings for today must be scheduled at least 50 minutes in advance.'}, status=400)
        if booking_type == 'regular':
            slot_end_times = {
                'morning': parse_time('12:00:00'),
                'afternoon': parse_time('16:00:00'),
                'evening': parse_time('20:00:00'),
            }
            slot_end = slot_end_times.get(time_slot)
            if slot_end and min_allowed_time >= slot_end:
                return JsonResponse({'ok': False, 'error': f'The selected {time_slot} slot is no longer available for today. Please select a later slot or date.'}, status=400)

    try:
        line_items, subtotal, discount_amount, total_amount, coupon_code = _resolve_cart_pricing(
            cart, payload.get('coupon_code')
        )
    except CartError as exc:
        return JsonResponse({'ok': False, 'error': exc.message}, status=400)

    try:
        with transaction.atomic():
            booking = Booking.objects.create(
                user=request.user,
                address_label=address.get('label') or 'Address',
                address_text=address.get('text'),
                address_pincode=address.get('pincode') or '',
                address_lat=address_lat,
                address_lng=address_lng,
                scheduled_date=scheduled_date,
                booking_type=booking_type,
                time_slot=time_slot if booking_type == 'regular' else '',
                exact_time=exact_time if booking_type == 'urgent' else None,
                payment_method=payment_method,
                payment_status='pending',
                subtotal=subtotal,
                discount_amount=discount_amount,
                total_amount=total_amount,
                coupon_code=coupon_code,
            )
            BookingItem.objects.bulk_create([
                BookingItem(
                    booking=booking,
                    service_variant=None if li['is_package'] else li['variant'],
                    package=li['variant'] if li['is_package'] else None,
                    name_snapshot=(
                        li['item_name'] if li['is_package'] or not li['variant'].label
                        else f"{li['item_name']} — {li['variant'].label}"
                    ),
                    price_snapshot=li['price'],
                    duration_snapshot=li['duration'],
                    included_snapshot=li['included_snapshot'],
                    quantity=li['qty'],
                )
                for li in line_items
            ])
    except Exception:
        logger.exception('Mobile checkout failed for user=%s.', request.user.id)
        return JsonResponse({'ok': False, 'error': 'Something went wrong completing your booking — please try again.'}, status=500)

    return JsonResponse({'ok': True, 'booking_number': booking.booking_number})
