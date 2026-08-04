import json

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_http_methods

from core import booking_data

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
        first_name = request.POST.get('first_name', '').strip()
        last_name = request.POST.get('last_name', '').strip()
        phone = request.POST.get('phone', '').strip()

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

    address = Address.objects.create(
        user=request.user,
        label=(payload.get('label') or '').strip() or 'Address',
        text=text,
        pincode=(payload.get('pincode') or '').strip(),
        lat=payload.get('lat'),
        lng=payload.get('lng'),
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
