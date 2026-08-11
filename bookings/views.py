import hashlib
import json
import logging
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.cache import cache
from django.db import transaction
from django.db.models import Avg, Count
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_time
from django.views.decorators.http import require_POST

from catalog.models import Package, Service
from core import booking_data

from . import razorpay_client
from .invoice import generate_booking_receipt_pdf
from .models import Booking, BookingItem, Offer, Review

logger = logging.getLogger(__name__)

# booking_drawer.js's data-payment-value uses hyphens; the model's choices
# use underscores (more conventional for a Python/DB field).
PAYMENT_METHOD_MAP = {
    'pay-now': 'pay_now',
    'pay-at-home': 'pay_at_home',
}


class CartError(Exception):
    """A cart line/coupon failed resolution — .message is the user-facing JSON error."""
    def __init__(self, message):
        self.message = message
        super().__init__(message)


def _resolve_cart_pricing(cart, coupon_code_raw):
    """
    Cart -> real ServiceVariant/Package prices, server-side (never
    trust client-sent totals) — shared by create_booking and
    create_razorpay_order so the amount a customer actually pays through
    Razorpay and the amount their booking is created for can never drift
    apart from computing it two different ways.

    A line's `id` (slug) is looked up against `Service` first, then
    `Package` — the two are separate tables/models now (see
    catalog/models.py), but a cart line has no other way to say which
    one it means, so whichever table actually has that slug wins (slugs
    are kept unique across both at creation time — see
    core/admin_dashboard_views.py — so this is never actually ambiguous
    in practice). A line's variantId (set once the quick-view variant
    picker exists — see developed.md "Catalog & Bookings models") picks
    a specific variant; omitted/blank (packages, or a line added from
    the marketing page, which has no picker) falls back to the item's
    default variant, same as before variants were selectable.

    Returns (line_items, subtotal, discount_amount, total_amount, coupon_code).
    Each line_items entry additionally carries 'is_package' so callers
    know whether to set BookingItem.service_variant or .package. A
    package line's 'variant' is the Package instance itself, not a
    separate variant row — see Package's docstring in catalog/models.py.
    Raises CartError with a user-facing message on any invalid line.
    """
    if not cart:
        raise CartError('Your cart is empty.')

    line_items = []
    subtotal = Decimal('0')
    for line in cart:
        slug = line.get('id')
        variant_id = line.get('variantId')
        try:
            qty = max(1, int(line.get('qty') or 1))
        except (TypeError, ValueError):
            raise CartError('Invalid cart quantity.')
        if qty > 20:
            raise CartError('Quantity per item is capped at 20 — contact us for bulk bookings.')

        is_package = False
        item = Service.objects.filter(slug=slug, is_active=True).first()
        if not item:
            item = Package.objects.filter(slug=slug, is_active=True).first()
            is_package = True
        if not item:
            raise CartError(f'"{slug}" is no longer available.')
        if is_package:
            # A package has no separate variant row to resolve — it IS
            # the priced thing (see catalog/models.py::Package).
            variant = item
        elif variant_id:
            variant = item.variants.filter(id=variant_id, is_active=True).first()
        else:
            variant = item.default_variant
        if not variant:
            raise CartError(f'"{slug}" is no longer available.')

        price, duration, included_snapshot = variant.price, variant.duration_mins, []
        if is_package:
            included_map = line.get('included') or {}
            resolved, any_customized = [], False
            for inc_service in item.included_services.filter(is_active=True):
                inc_default = inc_service.default_variant
                if not inc_default:
                    continue
                chosen_id = included_map.get(str(inc_service.id)) or included_map.get(inc_service.id)
                chosen_variant = inc_service.variants.filter(id=chosen_id, is_active=True).first() if chosen_id else None
                if not chosen_variant:
                    chosen_variant = inc_default
                elif chosen_variant.id != inc_default.id:
                    any_customized = True
                resolved.append((inc_service, chosen_variant))

            if resolved:
                included_snapshot = [
                    {
                        'name': inc.name,
                        'variant_label': cv.label or '',
                        'price': float(cv.price),
                        'duration_mins': cv.duration_mins,
                    }
                    for inc, cv in resolved
                ]
            # Only override the package's own price/duration when the
            # customer actually picked something other than every included
            # service's default — an un-customized package keeps charging
            # exactly what it always did (the Package's own stored price),
            # so this can never silently drift for the common case.
            if any_customized:
                total_mrp = sum((cv.price for _, cv in resolved), Decimal('0'))
                total_duration = sum(cv.duration_mins for _, cv in resolved)
                discount_pct = variant.discount_pct or 0
                if discount_pct:
                    price = (total_mrp * (Decimal(100) - Decimal(discount_pct)) / Decimal(100)).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
                else:
                    price = total_mrp
                duration = total_duration

        line_items.append({
            'variant': variant, 'is_package': is_package, 'item_name': item.name,
            'qty': qty, 'price': price, 'duration': duration, 'included_snapshot': included_snapshot,
        })
        subtotal += price * qty

    coupon_code = (coupon_code_raw or '').strip().upper()
    offer = Offer.objects.filter(code=coupon_code, is_active=True).first() if coupon_code else None
    discount_rate = Decimal(offer.discount_pct) / Decimal(100) if offer else Decimal('0')
    try:
        discount_amount = (subtotal * discount_rate).quantize(Decimal('0.01'))
    except InvalidOperation:
        discount_amount = Decimal('0')
    total_amount = subtotal - discount_amount

    return line_items, subtotal, discount_amount, total_amount, (coupon_code if discount_rate else '')


# How long a just-created Razorpay order is considered reusable for a
# retried request with the exact same cart — long enough to cover a slow
# network retry or an accidental refresh before paying, short enough that
# a stale entry for an abandoned cart doesn't linger meaningfully.
RAZORPAY_ORDER_CACHE_TTL = 15 * 60


def _cart_signature(cart, coupon_code, total_amount):
    payload = json.dumps({'cart': cart, 'coupon_code': coupon_code or '', 'total': str(total_amount)}, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


@login_required
@require_POST
def create_razorpay_order(request):
    """
    Step before the Razorpay Checkout.js modal can open — creates a
    Razorpay Order for the cart's server-computed total (never the
    amount the client claims) and hands back just enough for the modal:
    order_id, amount, and the public key_id. create_booking later
    verifies the payment actually made against this same order.

    Idempotent per user+cart (AUDIT_FINDINGS.md #7): a retried request for
    the exact same cart — client timeout, page refresh before paying —
    reuses the same still-open Razorpay order instead of minting a second,
    disconnected one. Only a genuinely different cart, or a cart whose
    cached order already got paid, mints a fresh order.
    """
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({'ok': False, 'error': 'Invalid request body.'}, status=400)

    cart = payload.get('cart') or []

    try:
        _, _, _, total_amount, coupon_code = _resolve_cart_pricing(cart, payload.get('coupon_code'))
    except CartError as exc:
        return JsonResponse({'ok': False, 'error': exc.message}, status=400)

    if total_amount <= 0:
        return JsonResponse({'ok': False, 'error': 'Cart total must be greater than zero.'}, status=400)

    cache_key = f'razorpay_pending_order:{request.user.id}:{_cart_signature(cart, coupon_code, total_amount)}'
    cached = cache.get(cache_key)

    if cached:
        try:
            existing = razorpay_client.fetch_order(cached['order_id'])
        except (razorpay_client.RazorpayError, Exception):
            existing = None
        if existing and existing.get('status') != 'paid':
            return JsonResponse({
                'ok': True,
                'order_id': existing['id'],
                'amount': existing['amount'],
                'key_id': settings.RAZORPAY_KEY_ID,
            })
        cache.delete(cache_key)

    try:
        order = razorpay_client.create_order(
            amount_paise=int((total_amount * 100).to_integral_value()),
            receipt=f'user-{request.user.id}-{int(timezone.now().timestamp())}',
        )
    except (razorpay_client.RazorpayError, Exception):
        return JsonResponse({'ok': False, 'error': "Couldn't start payment right now — please try again shortly."}, status=502)

    cache.set(cache_key, {'order_id': order['id']}, RAZORPAY_ORDER_CACHE_TTL)

    return JsonResponse({
        'ok': True,
        'order_id': order['id'],
        'amount': order['amount'],
        'key_id': settings.RAZORPAY_KEY_ID,
    })


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

    try:
        address_lat = float(address['lat']) if address.get('lat') is not None else None
        address_lng = float(address['lng']) if address.get('lng') is not None else None
    except (TypeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Invalid address coordinates.'}, status=400)
    if booking_type not in ('regular', 'urgent'):
        return JsonResponse({'ok': False, 'error': 'Invalid booking type.'}, status=400)
    if not payment_method:
        return JsonResponse({'ok': False, 'error': 'Invalid payment method.'}, status=400)

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

    try:
        line_items, subtotal, discount_amount, total_amount, coupon_code = _resolve_cart_pricing(
            cart, payload.get('coupon_code')
        )
    except CartError as exc:
        return JsonResponse({'ok': False, 'error': exc.message}, status=400)

    razorpay_order_id = ''
    razorpay_payment_id = ''
    payment_status = 'pending'

    if payment_method == 'pay_now':
        razorpay_order_id = (payload.get('razorpay_order_id') or '').strip()
        razorpay_payment_id = (payload.get('razorpay_payment_id') or '').strip()
        razorpay_signature = (payload.get('razorpay_signature') or '').strip()

        if not (razorpay_order_id and razorpay_payment_id and razorpay_signature):
            return JsonResponse({'ok': False, 'error': 'Payment details are missing — please pay again.'}, status=400)
        if not razorpay_client.verify_payment_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature):
            return JsonResponse({'ok': False, 'error': 'Payment could not be verified — please try again.'}, status=400)

        # Re-fetch the order's amount from Razorpay itself rather than
        # trusting anything client-supplied — confirms what was actually
        # paid matches this cart's server-computed total right now (e.g.
        # the cart can't have changed between opening the payment modal
        # and this request without the two amounts disagreeing).
        try:
            order = razorpay_client.fetch_order(razorpay_order_id)
        except Exception:
            return JsonResponse({'ok': False, 'error': "Couldn't confirm payment right now — please try again shortly."}, status=502)
        if order.get('amount') != int((total_amount * 100).to_integral_value()):
            return JsonResponse({'ok': False, 'error': 'Paid amount does not match your cart — please try again.'}, status=400)

        payment_status = 'paid'

    # Payment (if any) is already verified as 'paid' above by this point —
    # without atomicity, a failure partway through (e.g. bulk_create
    # raising on a bad row) would leave an orphaned, already-paid Booking
    # with zero items: real money collected, nothing actually booked. The
    # try/except matches every other failure path in this view (clean
    # JSON error, not a raw 500) — logged loudly specifically when payment
    # was already collected, since there's no webhook/reconciliation
    # system yet to catch this any other way (see AUDIT_FINDINGS.md #1).
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
                payment_status=payment_status,
                razorpay_order_id=razorpay_order_id,
                razorpay_payment_id=razorpay_payment_id,
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
                    # A package has no variant `.label` to suffix — it's
                    # sold at one price, not several named options.
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
        if payment_status == 'paid':
            logger.exception(
                'Booking creation failed AFTER payment was verified (razorpay_order_id=%s, razorpay_payment_id=%s, user=%s) — payment collected, no booking created.',
                razorpay_order_id, razorpay_payment_id, request.user.id,
            )
        else:
            logger.exception('Booking creation failed for user=%s.', request.user.id)
        return JsonResponse({'ok': False, 'error': "Something went wrong completing your booking — please contact support before trying again."}, status=500)

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
    whose variant/parent still exist and are active — a booking can
    reference a since-deactivated variant via service_variant=NULL/
    package=NULL, both on_delete=SET_NULL) are attached as a plain Python
    attribute for the template to serialize per-booking via json_script,
    keyed by booking_number. A package's `variantId` is always null — a
    package has no separate variant to select, addItem() already treats a
    null variantId as "use the item's own current price" either way.
    """
    bookings = list(
        request.user.bookings
        .prefetch_related('items__service_variant__service', 'items__package', 'items__review')
        .all()
    )
    for booking in bookings:
        rebook_items = []
        for item in booking.items.all():
            if item.service_variant and item.service_variant.is_active and item.service_variant.service.is_active:
                rebook_items.append({'id': item.service_variant.service.slug, 'variantId': item.service_variant.id, 'qty': item.quantity})
            elif item.package and item.package.is_active:
                rebook_items.append({'id': item.package.slug, 'variantId': None, 'qty': item.quantity})
        booking.rebook_items = rebook_items
        # Client-side search match target (bookings_dashboard.js) — booking
        # number plus every item name, so "haircut" or "ELX123456" both find
        # the right card without a server round-trip for what's at most a
        # few dozen of the signed-in user's own bookings.
        item_names = ' '.join(item.name_snapshot for item in booking.items.all())
        booking.search_blob = f'{booking.booking_number} {item_names} {booking.address_text}'.lower()

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
    (status still 'upcoming', i.e. the beautician hasn't marked On The Way
    yet; see bookings/models.py). Re-checked here even though the
    dashboard template only renders the Cancel button when `can_cancel`
    was true at page-render time — that snapshot can go stale if the user
    leaves the tab open until the beautician marks on-the-way before
    clicking it.

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
        messages.error(request, 'This booking can no longer be cancelled — the beautician is already on the way or it’s completed/cancelled.')
    return redirect('bookings_dashboard')


@login_required
def booking_invoice(request, booking_number):
    """
    PDF receipt download for the signed-in user's own booking — gated on
    payment_status='paid' since a receipt only makes sense for money
    actually collected; there's nothing to hand a customer a receipt for
    on a still-pending pay_at_home order.
    """
    booking = get_object_or_404(Booking, booking_number=booking_number, user=request.user)
    if booking.payment_status != 'paid':
        messages.error(request, 'A receipt is only available once payment is completed for this booking.')
        return redirect('bookings_dashboard')

    pdf_bytes = generate_booking_receipt_pdf(booking)
    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="receipt-{booking.booking_number}.pdf"'
    return response


@login_required
@require_POST
def submit_review(request, item_id):
    """
    Rates one completed booking's service — an inline star click on the
    bookings dashboard, submitted via fetch the instant it's clicked (see
    static/js/bookings_dashboard.js), not a form with its own Submit
    button. Updatable: clicking a different star re-rates rather than
    erroring "already reviewed", matching how every star-rating widget
    elsewhere behaves. `get_object_or_404(..., booking__user=...)` doubles
    as the ownership check, same 404-not-403 pattern as cancel_booking
    above.

    Recomputes the Service/Package's aggregate `rating`/`reviews_count`
    from real Review rows on every submission, replacing whatever mock
    values it was seeded with — see catalog/models.py.
    """
    item = get_object_or_404(BookingItem, id=item_id, booking__user=request.user, booking__status='completed')

    if not item.service_variant and not item.package:
        return JsonResponse({'ok': False, 'error': 'This service is no longer available to rate.'}, status=400)

    try:
        rating = int(request.POST.get('rating', ''))
    except ValueError:
        rating = 0
    if rating not in range(1, 6):
        return JsonResponse({'ok': False, 'error': 'Rating must be between 1 and 5 stars.'}, status=400)

    is_package = item.package_id is not None
    reviewed = item.package if is_package else item.service_variant.service
    Review.objects.update_or_create(
        booking_item=item,
        defaults={
            'user': request.user,
            'package': reviewed if is_package else None,
            'service': None if is_package else reviewed,
            'rating': rating,
        },
    )

    agg = reviewed.reviews.aggregate(avg=Avg('rating'), count=Count('id'))
    reviewed.rating = round(agg['avg'] or 0, 1)
    reviewed.reviews_count = agg['count'] or 0
    reviewed.save(update_fields=['rating', 'reviews_count'])

    return JsonResponse({'ok': True, 'rating': rating})


@login_required
@require_POST
def submit_booking_feedback(request, booking_number):
    """
    One free-text write-up for the whole order (see Booking.feedback_comment
    docstring for why this is separate from each item's own star Review) —
    submitted via fetch from the single shared textarea + button on a
    completed booking's card. Updatable, same as submit_review.
    """
    booking = get_object_or_404(Booking, booking_number=booking_number, user=request.user, status='completed')
    comment = request.POST.get('comment', '').strip()
    booking.feedback_comment = comment
    booking.feedback_submitted_at = timezone.now()
    booking.save(update_fields=['feedback_comment', 'feedback_submitted_at'])
    return JsonResponse({'ok': True})
