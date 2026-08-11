import json

from django import forms
from django.contrib import messages
from django.contrib.auth import logout
from django.contrib.auth.decorators import login_required
from django.db.models import Avg, Count
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_http_methods, require_POST

from bookings.models import Review
from catalog.models import Package, Service
from core import booking_data

from .fields import IndianPhoneField
from .models import Address, Profile


@login_required
def profile_view(request):
    """
    Account page: name/email (email is read-only here — it's also the
    allauth login identifier, changing it is a bigger flow with its own
    verification step that's out of scope right now) + phone, plus the
    saved-addresses list the booking drawer's address step also reads
    from (see addresses_api below). A plain form POST + redirect — unlike
    addresses_api, nothing else needs this data as JSON.
    """
    profile, _ = Profile.objects.get_or_create(user=request.user)

    if request.method == 'POST':
        first_name = request.POST.get('first_name', '').strip()[:150]
        last_name = request.POST.get('last_name', '').strip()[:150]
        phone = request.POST.get('phone', '').strip()[:20]

        if phone:
            try:
                phone = IndianPhoneField(required=False).clean(phone)
            except forms.ValidationError:
                messages.error(request, 'Enter a valid phone number.')
                return redirect('profile')
        if phone and Profile.objects.filter(phone=phone).exclude(user=request.user).exists():
            messages.error(request, 'That phone number is already registered to another account.')
            return redirect('profile')

        request.user.first_name = first_name
        request.user.last_name = last_name
        request.user.save(update_fields=['first_name', 'last_name'])
        profile.phone = phone
        profile.save(update_fields=['phone'])

        messages.success(request, 'Profile updated.')
        return redirect('profile')

    context = {
        'profile': profile,
        'addresses': request.user.addresses.all(),
        'booking_categories': booking_data.get_booking_categories(),
        'booking_offers': booking_data.get_booking_offers(),
        'booking_catalog': booking_data.get_booking_catalog(),
        'notifications': booking_data.get_notifications_mock(),
    }
    return render(request, 'booking/pages/profile.html', context)


@login_required
@require_POST
def delete_account(request):
    """
    Immediate, permanent self-service account deletion — no grace period,
    no "reactivate within 30 days" flow. Deleting the User row cascades to
    Profile/Address/EmailAddress/Review (see accounts/models.py,
    bookings/models.py) — but NOT to Booking, which is on_delete=SET_NULL
    specifically so a deleted account doesn't also erase real order/
    revenue history from the admin dashboard.

    Since Review.user is still CASCADE, this also drops the user's own
    reviews — which leaves the affected services'/packages' cached rating/
    reviews_count (CatalogItemBase.rating/reviews_count, normally
    recomputed in submit_review) stale unless recomputed here too. A
    review points at exactly one of Review.service/Review.package (see
    catalog model split, 2026-08-08), so both are collected here.
    """
    user = request.user
    user_reviews = Review.objects.filter(user=user)
    affected_service_ids = list(user_reviews.exclude(service_id=None).values_list('service_id', flat=True).distinct())
    affected_package_ids = list(user_reviews.exclude(package_id=None).values_list('package_id', flat=True).distinct())

    user.delete()
    logout(request)

    for service_id in affected_service_ids:
        service = Service.objects.filter(id=service_id).first()
        if not service:
            continue
        agg = service.reviews.aggregate(avg=Avg('rating'), count=Count('id'))
        service.rating = round(agg['avg'] or 0, 1)
        service.reviews_count = agg['count'] or 0
        service.save(update_fields=['rating', 'reviews_count'])

    for package_id in affected_package_ids:
        package = Package.objects.filter(id=package_id).first()
        if not package:
            continue
        agg = package.reviews.aggregate(avg=Avg('rating'), count=Count('id'))
        package.rating = round(agg['avg'] or 0, 1)
        package.reviews_count = agg['count'] or 0
        package.save(update_fields=['rating', 'reviews_count'])

    messages.success(request, 'Your account has been permanently deleted.')
    return redirect('index')


@login_required
@require_http_methods(['GET', 'POST'])
def addresses_api(request):
    """
    JSON list/create — the one thing shared between the profile page's own
    address section and the booking drawer's address step (which used to
    read/write these from localStorage; see developed.md "Profile & saved
    addresses" for why that changed). Both sides fetch() this exactly the
    same way, so there's one source of truth per user instead of two.
    """
    if request.method == 'GET':
        addresses = list(request.user.addresses.values('id', 'label', 'text', 'pincode', 'lat', 'lng'))
        return JsonResponse({'addresses': addresses})

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


@login_required
@require_http_methods(['POST', 'DELETE'])
def address_delete(request, address_id):
    """get_object_or_404(..., user=request.user) doubles as the ownership
    check, same pattern as bookings/views.py::cancel_booking — a 404, not
    a 403, for someone else's address_id."""
    address = get_object_or_404(Address, id=address_id, user=request.user)
    address.delete()
    return JsonResponse({'ok': True})
