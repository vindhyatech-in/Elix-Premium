import json
import logging
from datetime import timedelta

from django import forms
from django.contrib.auth import authenticate
from django.contrib.auth.models import Group, User
from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_time
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from decimal import Decimal

from django.conf import settings
from django.core.cache import cache
from django.db.models import Avg, Count
from accounts import whatsapp_otp
from accounts.fields import IndianPhoneField
from accounts.models import Address, Employee, Profile
from accounts.utils import generate_username_from_name
from allauth.account.adapter import get_adapter
from bookings import razorpay_client
from bookings.models import Booking, BookingItem, Offer, Review
from bookings.notifications import notify_user
from bookings.views import PAYMENT_METHOD_MAP, CartError, _resolve_cart_pricing
from catalog.models import Category, Package, Service
from core import booking_data
from core.email_service import send_booking_email_all
from core.models import (
    FAQ, GalleryBeforeAfter, Hero, HowItWorksStep, PromoBanner,
    Testimonial, TrustBadge, TrustPoint,
)

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


@require_GET
def service_detail_api(request, slug):
    """GET /api/v1/catalog/<slug>/
    Returns full details for a Service or Package, mirroring core/views.py::service_detail.
    """
    try:
        service = Service.objects.select_related('category', 'aftercare').prefetch_related('variants', 'steps').get(
            slug=slug, is_active=True,
        )
        kind = 'service'
    except Service.DoesNotExist:
        try:
            service = Package.objects.select_related('category').prefetch_related('included_services__variants').get(
                slug=slug, is_active=True,
            )
            kind = 'package'
        except Package.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Service or package not found'}, status=404)

    default_var = service if kind == 'package' else service.default_variant
    if not default_var:
        return JsonResponse({'status': 'error', 'message': 'Service has no active variant'}, status=404)

    # Variants
    variants_data = []
    if kind == 'service':
        for v in service.variants.filter(is_active=True).order_by('sort_order', 'id'):
            variants_data.append({
                'id': v.id,
                'label': v.label or v.duration_label,
                'price': float(v.price),
                'mrp': float(v.mrp) if v.mrp else None,
                'duration_mins': v.duration_mins,
                'duration_label': v.duration_label,
                'discount_pct': v.discount_pct,
                'is_default': v.id == default_var.id,
            })

    # Included services for packages
    included_services_data = []
    if kind == 'package':
        for inc in service.included_services.all():
            inc_vars = [
                {
                    'id': iv.id,
                    'label': iv.label or iv.duration_label,
                    'price': float(iv.price),
                    'duration_mins': iv.duration_mins,
                    'duration_label': iv.duration_label,
                }
                for iv in inc.variants.filter(is_active=True)
            ]
            inc_default = inc.default_variant
            if inc_default:
                included_services_data.append({
                    'id': inc.id,
                    'name': inc.name,
                    'photo': inc.display_photo_url,
                    'selected_variant_id': inc_default.id,
                    'price': float(inc_default.price),
                    'duration_mins': inc_default.duration_mins,
                    'duration_label': inc_default.duration_label,
                    'variants': inc_vars,
                })

    # Treatment steps (How treatment works)
    steps_data = []
    if kind == 'service':
        for step in service.steps.all():
            steps_data.append({
                'sort_order': step.sort_order,
                'title': step.title,
                'description': step.description,
                'badge': step.badge,
                'image': step.display_image_url,
            })

    # After-care tips
    aftercare_data = None
    if kind == 'service' and hasattr(service, 'aftercare') and service.aftercare:
        ac = service.aftercare
        if ac.tips_list:
            aftercare_data = {
                'title': ac.title or 'After-Care Tips',
                'tips': ac.tips_list,
            }

    # Reviews
    reviews_data = []
    reviews_qs = service.reviews.select_related('user').order_by('-created_at')[:20]
    for r in reviews_qs:
        name = r.user.get_full_name() or r.user.first_name or r.user.username or 'Customer'
        reviews_data.append({
            'id': r.id,
            'name': name,
            'rating': r.rating or 5,
            'created_at': r.created_at.strftime('%d %b %Y') if hasattr(r, 'created_at') and r.created_at else None,
            'comment': getattr(r, 'comment', '') or '',
            'verified': True,
        })

    # Service FAQs
    faqs_data = [
        {
            'question': 'How do beauticians ensure hygiene at home?',
            'answer': 'Our professionals carry single-use disposables, sterilized tools, and open sealed product sachets directly in front of you.'
        },
        {
            'question': 'Can I select a preferred time slot?',
            'answer': 'Yes! You can choose any convenient date and time during checkout. Express 50-minute delivery is also available for today.'
        },
        {
            'question': 'What if I need to reschedule or cancel?',
            'answer': 'Free cancellation and instant rescheduling are available up to 2 hours before your booked appointment slot.'
        },
    ]

    # How at-home salon works (Urban Company standard 3 steps)
    how_it_works = [
        {
            'step': '01',
            'title': 'Beautician Arrival & Prep',
            'desc': 'Certified female professional arrives at your doorstep equipped with salon setup and hygiene disposable kit.',
        },
        {
            'step': '02',
            'title': 'Sealed Product Unboxing',
            'desc': 'All products are mono-doses opened right before your eyes to guarantee 100% purity and safety.',
        },
        {
            'step': '03',
            'title': 'Flawless Service & Clean-up',
            'desc': 'Enjoy luxury salon treatment at home, followed by complete post-service clean-up and care guidance.',
        },
    ]

    # Quality promises (4 pillars)
    promises = [
        {'title': '100% Certified', 'desc': 'Background-verified beauticians', 'icon': 'shield-checkmark-outline'},
        {'title': 'Mono-Dose Kits', 'desc': 'Sealed single-use sachets opened in front of you', 'icon': 'cube-outline'},
        {'title': 'Free Rescheduling', 'desc': 'Instant reschedule or cancellation anytime', 'icon': 'time-outline'},
        {'title': 'Mess-Free Clean-up', 'desc': 'Spotless post-service home clean-up', 'icon': 'sparkles-outline'},
    ]

    # Related items
    related_model = Package if kind == 'package' else Service
    related_qs = related_model.objects.filter(category=service.category, is_active=True).exclude(id=service.id)[:4]
    related_items = []
    for rel in related_qs:
        rel_var = rel if kind == 'package' else rel.default_variant
        if rel_var:
            related_items.append({
                'id': rel.slug,
                'slug': rel.slug,
                'name': rel.name,
                'kind': kind,
                'category': rel.category.name,
                'photo': rel.display_photo_url,
                'price': float(rel_var.price),
                'mrp': float(rel_var.mrp) if rel_var.mrp else None,
                'duration_label': rel_var.duration_label,
                'rating': float(rel.rating),
            })

    item_data = {
        'id': service.slug,
        'slug': service.slug,
        'kind': kind,
        'category': service.category.name,
        'category_slug': service.category.slug,
        'name': service.name,
        'description': service.description,
        'photo': service.display_photo_url,
        'price': float(default_var.price),
        'mrp': float(default_var.mrp) if default_var.mrp else None,
        'discount_pct': default_var.discount_pct,
        'duration_mins': default_var.duration_mins,
        'duration_label': default_var.duration_label,
        'rating': float(service.rating),
        'reviews_count': service.reviews_count,
        'available_today': service.available_today,
        'badges': service.badges or [],
        'variant_id': default_var.id if kind == 'service' else None,
        'variants': variants_data,
        'included_services': included_services_data,
        'steps': steps_data,
        'aftercare': aftercare_data,
        'reviews': reviews_data,
        'faqs': faqs_data,
        'how_it_works': how_it_works,
        'promises': promises,
        'related_items': related_items,
    }

    return JsonResponse({'status': 'success', 'item': item_data})


def offers_view(request):
    """Active coupon codes — GET /api/v1/offers/."""
    return JsonResponse({'status': 'success', 'offers': booking_data.get_booking_offers()})


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def validate_coupon_view(request):
    """
    GET/POST /api/v1/validate-coupon/
    Validates a coupon code against active Offer rows in the database.
    """
    code = ''
    if request.method == 'POST':
        if request.content_type == 'application/json':
            try:
                payload = json.loads(request.body.decode('utf-8'))
                code = payload.get('code', '')
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass
        else:
            code = request.POST.get('code', '')
    else:
        code = request.GET.get('code', '')

    code = (code or '').strip().upper()
    if not code:
        return JsonResponse({'valid': False, 'discount_pct': 0, 'message': 'Please enter a coupon code.'})

    offer = Offer.objects.filter(code__iexact=code, is_active=True).first()
    if offer:
        return JsonResponse({
            'valid': True,
            'code': offer.code,
            'discount_pct': offer.discount_pct,
            'message': f'{offer.discount_pct}% discount applied!',
        })

    return JsonResponse({
        'valid': False,
        'discount_pct': 0,
        'message': 'Invalid or expired coupon code.',
    })



def home_view(request):
    """GET /api/v1/home/ — the mobile app's landing-page equivalent, one
    aggregated payload mirroring core/views.py::index()'s context
    (marketing content, not the booking catalog — packages are served
    by catalog_view above, kind='package', not duplicated here).
    Public/anonymous, same as every other section it draws from."""
    hero = Hero.objects.filter(is_active=True).first()
    beauticians = Employee.objects.filter(status='active').select_related('user', 'user__profile').order_by('sort_order', 'user__first_name', 'user__last_name')

    return JsonResponse({
        'status': 'success',
        'hero': {
            'eyebrow': hero.eyebrow,
            'headline_lines': hero.headline_lines,
            'subhead': hero.subhead,
            'primary_cta_label': hero.primary_cta_label,
            'primary_cta_href': hero.primary_cta_href,
            'photo': hero.display_photo_url,
        } if hero else None,
        'promo_banners': [
            {
                'title': b.title,
                'subtitle': b.subtitle,
                'cta_label': b.cta_label,
                'cta_href': b.cta_href,
                'photo': b.display_photo_url,
            }
            for b in PromoBanner.objects.filter(is_active=True)
        ],
        'categories': booking_data.get_landing_categories(),
        'how_it_works': list(HowItWorksStep.objects.values('step', 'title', 'body', 'icon')),
        'before_after': [
            {
                'label': g.label,
                'tone': g.tone,
                'before_photo': g.display_before_photo_url,
                'after_photo': g.display_after_photo_url,
            }
            for g in GalleryBeforeAfter.objects.all()
        ],
        'testimonials': list(Testimonial.objects.values('name', 'location', 'rating', 'quote', 'service')),
        # Only public-safe fields — never phone/email/face_photo_* (job-
        # verification photos), same boundary the web's own "meet the
        # team" section already respects (see accounts/models.py::Employee).
        'beauticians': [
            {
                'slug': e.slug,
                'name': e.name,
                'specialties': e.specialties,
                'rating': float(e.rating),
                'reviews': e.reviews,
                'skills': e.skills,
                'experience_years': e.experience_years,
                'photo': e.display_photo_url,
            }
            for e in beauticians
        ],
        'trust_points': list(TrustPoint.objects.values('value', 'suffix', 'label', 'icon')),
        'trust_badges': list(TrustBadge.objects.values('title', 'body')),
        'faqs': list(FAQ.objects.values('question', 'answer')),
    })


def beauticians_view(request):
    """GET /api/v1/beauticians/ — active verified beauticians list."""
    beauticians = Employee.objects.filter(status='active').select_related('user', 'user__profile').order_by('sort_order', 'user__first_name', 'user__last_name')
    data = [
        {
            'slug': e.slug,
            'name': e.name,
            'specialties': e.specialties,
            'rating': float(e.rating),
            'reviews': e.reviews,
            'skills': e.skills or [],
            'experience_years': e.experience_years,
            'photo': e.display_photo_url,
        }
        for e in beauticians
    ]
    return JsonResponse({'status': 'success', 'beauticians': data})


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
    phone_val = user.profile.phone if hasattr(user, 'profile') else ''
    return JsonResponse({
        'ok': True,
        'token': token.key,
        'user': {
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'phone': phone_val,
        },
    })


@csrf_exempt
@require_POST
def auth_signup(request):
    """POST /api/v1/auth/signup/ — Customer registration endpoint.
    Accepts first_name, last_name, email, phone, age, password.
    Creates user, customer group assignment, profile, and auth token."""
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({'ok': False, 'error': 'Invalid request body.'}, status=400)

    first_name = (payload.get('first_name') or '').strip()
    last_name = (payload.get('last_name') or '').strip()
    email = (payload.get('email') or '').strip().lower()
    phone_raw = (payload.get('phone') or '').strip()
    age_raw = payload.get('age')
    password = payload.get('password') or ''

    if not first_name:
        return JsonResponse({'ok': False, 'error': 'First name is required.'}, status=400)
    if not email or '@' not in email:
        return JsonResponse({'ok': False, 'error': 'A valid email address is required.'}, status=400)
    if not password or len(password) < 6:
        return JsonResponse({'ok': False, 'error': 'Password must be at least 6 characters long.'}, status=400)

    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse({'ok': False, 'error': 'An account with this email already exists.'}, status=400)

    normalized_phone = ''
    if phone_raw:
        try:
            normalized_phone = IndianPhoneField(required=False).clean(phone_raw)
        except forms.ValidationError:
            return JsonResponse({'ok': False, 'error': 'Please enter a valid 10-digit Indian phone number.'}, status=400)

        if normalized_phone and Profile.objects.filter(phone=normalized_phone).exists():
            return JsonResponse({'ok': False, 'error': 'That phone number is already registered to another account.'}, status=400)

    age = None
    if age_raw is not None and str(age_raw).strip():
        try:
            age = int(age_raw)
            if age < 13 or age > 120:
                return JsonResponse({'ok': False, 'error': 'Age must be between 13 and 120.'}, status=400)
        except ValueError:
            return JsonResponse({'ok': False, 'error': 'Please enter a valid age.'}, status=400)

    with transaction.atomic():
        username = generate_username_from_name(first_name, last_name)
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
        customer_group, _ = Group.objects.get_or_create(name='customer')
        user.groups.add(customer_group)

        profile, _ = Profile.objects.get_or_create(user=user)
        if normalized_phone:
            profile.phone = normalized_phone
        if age:
            profile.age = age
        profile.save()

        token, _ = AuthToken.objects.get_or_create(user=user)

    return JsonResponse({
        'ok': True,
        'token': token.key,
        'user': {
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'phone': profile.phone,
        },
    }, status=201)


def _mask_phone_display(phone):
    if not phone:
        return ''
    digits = ''.join(c for c in phone if c.isdigit())
    if len(digits) >= 10:
        return f'+91 ••••• •{digits[-4:]}'
    return phone


def _mask_email_display(email):
    if not email or '@' not in email:
        return email or ''
    name, domain = email.split('@', 1)
    if len(name) <= 2:
        masked_name = name[0] + '*'
    else:
        masked_name = name[0] + '*' * (len(name) - 2) + name[-1]
    return f'{masked_name}@{domain}'


@csrf_exempt
@require_POST
def auth_phone_request(request):
    """POST /api/v1/auth/phone/request/ — Request 6-digit OTP for phone/email login or verification.
    Accepts `identifier` (phone number or email), optional `channel` ('phone'|'email'),
    and optional `purpose`."""
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({'ok': False, 'error': 'Invalid request body.'}, status=400)

    raw_ident = (payload.get('identifier') or '').strip()
    channel = (payload.get('channel') or '').strip().lower()
    purpose = (payload.get('purpose') or 'Login to Elix Premium Salon').strip()

    if not raw_ident:
        return JsonResponse({'ok': False, 'error': 'Please enter your phone number or email address.'}, status=400)

    is_signup = any(k in purpose.lower() for k in ['signup', 'sign up', 'register', 'verification'])

    phone = ''
    email = ''

    if channel == 'email' or ('@' in raw_ident and channel != 'phone'):
        email = raw_ident.lower()
        if not email or '@' not in email:
            return JsonResponse({'ok': False, 'error': 'Please enter a valid email address.'}, status=400)
        if is_signup and User.objects.filter(email__iexact=email).exists():
            return JsonResponse({'ok': False, 'error': 'An account with this email already exists. Please log in.'}, status=400)
        if not is_signup:
            user = User.objects.filter(email__iexact=email, is_active=True).first()
            if user and hasattr(user, 'profile') and user.profile.phone:
                phone = user.profile.phone
    else:
        try:
            phone = IndianPhoneField(required=False).clean(raw_ident)
        except forms.ValidationError:
            return JsonResponse({'ok': False, 'error': 'Please enter a valid 10-digit Indian phone number.'}, status=400)
        if is_signup and Profile.objects.filter(phone=phone).exists():
            return JsonResponse({'ok': False, 'error': 'This phone number is already registered. Please log in.'}, status=400)

        if not is_signup:
            user = get_adapter().get_user_by_phone(phone)
            if not user and phone:
                digits = ''.join(c for c in str(phone) if c.isdigit())
                if len(digits) >= 10:
                    user = User.objects.filter(profile__phone__endswith=digits[-10:]).first()
            if user and user.email:
                email = user.email

    if not is_signup and not email:
        if phone:
            return JsonResponse({
                'ok': False,
                'not_found': True,
                'error': 'No account found for this phone number. Please sign up or enter your registered email address.',
            }, status=404)
        return JsonResponse({'ok': False, 'error': 'Please enter a valid phone number or email address.'}, status=400)

    try:
        verification_id = whatsapp_otp.send_otp(phone=phone, email=email, purpose=purpose)
    except Exception as e:
        logger.exception('send_otp failed for identifier=%s', raw_ident)
        return JsonResponse({'ok': False, 'error': "Couldn't send verification code. Please try again shortly."}, status=500)

    masked = _mask_email_display(email) if email else (f'+91 •••• {phone[-4:]}' if phone else '')

    resp_data = {
        'ok': True,
        'verification_id': verification_id,
        'masked_identifier': masked,
    }
    if getattr(settings, 'DEBUG', False):
        cache_key = f'{whatsapp_otp.CACHE_PREFIX}{verification_id}'
        cached = cache.get(cache_key)
        if cached and isinstance(cached, dict):
            resp_data['dev_code'] = cached.get('code')

    return JsonResponse(resp_data)


@csrf_exempt
@require_POST
def auth_verify_code(request):
    """POST /api/v1/auth/verify-code/ — Validate 6-digit OTP code without requiring an existing user.
    Used for on-page mobile or email verification during sign up.
    """
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({'ok': False, 'error': 'Invalid request body.'}, status=400)

    verification_id = (payload.get('verification_id') or '').strip()
    code = (payload.get('code') or '').strip()

    if not verification_id or not code:
        return JsonResponse({'ok': False, 'error': 'Verification ID and code are required.'}, status=400)

    cache_key = f'{whatsapp_otp.CACHE_PREFIX}{verification_id}'
    stored = cache.get(cache_key)
    if not stored or not isinstance(stored, dict):
        return JsonResponse({'ok': False, 'error': 'Verification code has expired. Please request a new one.'}, status=400)

    phone = stored.get('phone')
    email = stored.get('email')

    verified = whatsapp_otp.validate_otp(verification_id, code)
    if not verified:
        return JsonResponse({'ok': False, 'error': 'Incorrect or expired verification code.'}, status=400)

    return JsonResponse({
        'ok': True,
        'verified': True,
        'phone': phone,
        'email': email,
        'message': 'Verification code confirmed successfully.',
    })


@csrf_exempt
@require_POST
def auth_phone_verify(request):
    """POST /api/v1/auth/phone/verify/ — Validate 6-digit OTP and return AuthToken."""
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({'ok': False, 'error': 'Invalid request body.'}, status=400)

    verification_id = (payload.get('verification_id') or '').strip()
    code = (payload.get('code') or '').strip()

    if not verification_id or not code:
        return JsonResponse({'ok': False, 'error': 'Verification ID and code are required.'}, status=400)

    cache_key = f'{whatsapp_otp.CACHE_PREFIX}{verification_id}'
    stored = cache.get(cache_key)
    if not stored or not isinstance(stored, dict):
        return JsonResponse({'ok': False, 'error': 'Verification code has expired. Please request a new one.'}, status=400)

    phone = stored.get('phone')
    email = stored.get('email')

    verified = whatsapp_otp.validate_otp(verification_id, code)
    if not verified:
        return JsonResponse({'ok': False, 'error': 'Incorrect or expired verification code.'}, status=400)

    user = None
    if phone:
        user = get_adapter().get_user_by_phone(phone)
        if not user:
            digits = ''.join(c for c in str(phone) if c.isdigit())
            if len(digits) >= 10:
                user = User.objects.filter(profile__phone__endswith=digits[-10:]).first()
    if not user and email:
        user = User.objects.filter(email__iexact=email, is_active=True).first()

    if not user:
        return JsonResponse({
            'ok': False,
            'not_found': True,
            'phone': phone,
            'email': email,
            'error': 'No existing account found for this phone or email. Please sign up first.',
        }, status=404)

    if not user.is_active:
        return JsonResponse({'ok': False, 'error': 'This account has been disabled.'}, status=400)

    if phone:
        get_adapter().set_phone_verified(user, phone)

    token, _ = AuthToken.objects.get_or_create(user=user)
    return JsonResponse({
        'ok': True,
        'token': token.key,
        'user': {
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'phone': user.profile.phone if hasattr(user, 'profile') else '',
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
@require_POST
@token_required
def change_password_view(request):
    """
    POST /api/v1/auth/change-password/
    Payload: { "current_password": "...", "new_password": "..." }
    """
    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'Invalid JSON body.'}, status=400)

    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')

    if not current_password or not new_password:
        return JsonResponse({'error': 'Both current password and new password are required.'}, status=400)

    if not request.user.check_password(current_password):
        return JsonResponse({'error': 'Current password does not match.'}, status=400)

    if len(new_password) < 6:
        return JsonResponse({'error': 'New password must be at least 6 characters long.'}, status=400)

    if current_password == new_password:
        return JsonResponse({'error': 'New password cannot be the same as your current password.'}, status=400)

    request.user.set_password(new_password)
    request.user.save()

    return JsonResponse({'ok': True, 'message': 'Password changed successfully.'})


@require_http_methods(['GET'])
def auth_social_callback(request):
    """
    GET /api/v1/auth/social-callback/
    Dispatched when allauth finishes social OAuth (Google/Apple).
    If the user authenticated successfully, generates an AuthToken and redirects
    to return_url with token and user parameters.
    """
    from urllib.parse import urlencode, quote
    return_url = request.GET.get('return_url') or 'http://localhost:8081/auth/callback'

    if not request.user.is_authenticated:
        sep = '&' if '?' in return_url else '?'
        return redirect(f"{return_url}{sep}error=" + quote("Social authentication failed."))

    token, _ = AuthToken.objects.get_or_create(user=request.user)
    phone = ''
    try:
        if hasattr(request.user, 'profile') and request.user.profile.phone:
            phone = request.user.profile.phone
    except Exception:
        pass

    user_data = {
        'id': request.user.id,
        'email': request.user.email,
        'first_name': request.user.first_name,
        'last_name': request.user.last_name,
        'phone': phone,
    }

    sep = '&' if '?' in return_url else '?'
    params = urlencode({
        'token': token.key,
        'user': json.dumps(user_data),
    })
    return redirect(f"{return_url}{sep}{params}")



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

    return JsonResponse({
        'ok': True,
        'user': {
            'email': request.user.email,
            'first_name': request.user.first_name,
            'last_name': request.user.last_name,
        },
        'phone': profile.phone,
    })


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
@require_http_methods(['GET', 'POST', 'PUT', 'DELETE'])
def address_detail_api(request, address_id):
    """GET/PUT/POST/DELETE /api/v1/addresses/<id>/ — retrieve, update, or delete
    a saved address for the authenticated user."""
    address = get_object_or_404(Address, id=address_id, user=request.user)

    if request.method == 'DELETE':
        address.delete()
        return JsonResponse({'ok': True})

    if request.method == 'GET':
        return JsonResponse({'ok': True, 'address': {
            'id': address.id, 'label': address.label, 'text': address.text,
            'pincode': address.pincode, 'lat': address.lat, 'lng': address.lng,
        }})

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
        lat = float(lat) if lat is not None else address.lat
        lng = float(lng) if lng is not None else address.lng
    except (TypeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Invalid map coordinates.'}, status=400)

    address.label = (payload.get('label') or '').strip()[:60] or address.label
    address.text = text
    address.pincode = pincode
    address.lat = lat
    address.lng = lng
    address.save()

    return JsonResponse({'ok': True, 'address': {
        'id': address.id, 'label': address.label, 'text': address.text,
        'pincode': address.pincode, 'lat': address.lat, 'lng': address.lng,
    }})


address_delete_view = address_detail_api


def _serialize_booking(booking):
    items = []
    for item in booking.items.all():
        review_obj = getattr(item, 'review', None)
        items.append({
            'id': item.id,
            'name': item.name_snapshot,
            'price': float(item.price_snapshot),
            'quantity': item.quantity,
            'included': item.included_snapshot,
            'rating': review_obj.rating if review_obj else None,
            'beautician_rating': review_obj.beautician_rating if review_obj else None,
        })

    beautician_data = None
    if booking.assigned_beautician:
        b = booking.assigned_beautician
        photo_url = None
        if b.face_photo_front:
            photo_url = b.face_photo_front.url
        elif b.photo:
            photo_url = b.photo
        phone_val = b.phone or ''
        if not phone_val and hasattr(b, 'user') and b.user:
            profile = getattr(b.user, 'profile', None)
            phone_val = getattr(profile, 'phone', '') or getattr(b.user, 'phone', '')
        beautician_data = {
            'id': b.id,
            'name': b.name,
            'phone': phone_val or '',
            'photo': photo_url,
            'role': b.get_role_display() if hasattr(b, 'get_role_display') else 'Expert Beautician',
            'rating': float(b.rating) if b.rating else 5.0,
            'specialties': b.specialties or '',
        }

    rebook_items = []
    for item in booking.items.all():
        if item.service_variant and item.service_variant.service.is_active and item.service_variant.is_active:
            rebook_items.append({
                'id': item.service_variant.service.id,
                'variantId': item.service_variant.id,
                'name': item.name_snapshot,
                'price': float(item.price_snapshot),
                'quantity': item.quantity,
                'isPackage': False,
            })
        elif item.package and item.package.is_active:
            rebook_items.append({
                'id': item.package.id,
                'packageId': item.package.id,
                'name': item.name_snapshot,
                'price': float(item.price_snapshot),
                'quantity': item.quantity,
                'isPackage': True,
            })

    can_reschedule = booking.status in ('upcoming', 'pending', 'confirmed') and booking.can_cancel

    # Status refinement: if beautician is assigned while booking is upcoming/pending/confirmed, mark as 'assigned'
    effective_status = booking.status
    effective_status_display = booking.get_status_display()
    if booking.assigned_beautician and booking.status in ('upcoming', 'pending', 'confirmed'):
        effective_status = 'assigned'
        effective_status_display = 'Beautician Assigned'

    # Ensure start_otp is generated for 'on_the_way' orders
    start_otp = None
    if booking.status == 'on_the_way' and not booking.otp_verified_at:
        if not booking.start_otp:
            import secrets
            booking.start_otp = ''.join(secrets.choice('0123456789') for _ in range(6))
            booking.otp_generated_at = timezone.now()
            booking.save(update_fields=['start_otp', 'otp_generated_at'])
        start_otp = booking.start_otp

    return {
        'booking_number': booking.booking_number,
        'status': effective_status,
        'raw_status': booking.status,
        'status_display': effective_status_display,
        'scheduled_date': booking.scheduled_date.isoformat(),
        'booking_type': booking.booking_type,
        'time_slot': booking.time_slot,
        'time_slot_display': booking.get_time_slot_display() if booking.time_slot else None,
        'exact_time': booking.exact_time.strftime('%H:%M') if booking.exact_time else None,
        'address_label': booking.address_label,
        'address_text': booking.address_text,
        'address_pincode': booking.address_pincode or '',
        'customer_name': f"{booking.user.first_name} {booking.user.last_name or ''}".strip() if booking.user else 'Customer',
        'customer_phone': getattr(booking.user, 'phone', '') or (booking.user.profile.phone if hasattr(booking.user, 'profile') and getattr(booking.user.profile, 'phone', None) else ''),
        'payment_method': booking.payment_method,
        'payment_status': booking.payment_status,
        'subtotal': float(booking.subtotal),
        'discount_amount': float(booking.discount_amount),
        'urgent_fee': float(booking.urgent_fee),
        'total_amount': float(booking.total_amount),
        'coupon_code': booking.coupon_code or '',
        'can_cancel': booking.can_cancel,
        'can_reschedule': can_reschedule,
        'start_otp': start_otp,
        'otp_verified_at': booking.otp_verified_at.isoformat() if booking.otp_verified_at else None,
        'created_at': booking.created_at.isoformat() if booking.created_at else None,
        'rescheduled_at': booking.rescheduled_at.isoformat() if booking.rescheduled_at else None,
        'feedback_comment': booking.feedback_comment or '',
        'feedback_submitted_at': booking.feedback_submitted_at.isoformat() if booking.feedback_submitted_at else None,
        'assigned_beautician': beautician_data,
        'rebook_items': rebook_items,
        'items': items,
    }


@csrf_exempt
@token_required
@require_GET
def bookings_view(request):
    """GET /api/v1/bookings/ — the signed-in user's own bookings, same
    query as bookings/views.py::bookings_dashboard, JSON instead of a
    rendered template."""
    bookings = (
        request.user.bookings
        .select_related('assigned_beautician', 'user')
        .prefetch_related('items__service_variant__service', 'items__package', 'items__review')
        .all()
    )
    data = [_serialize_booking(b) for b in bookings]
    return JsonResponse({'ok': True, 'bookings': data})


@csrf_exempt
@token_required
@require_GET
def booking_detail_view(request, booking_number):
    """GET /api/v1/bookings/<booking_number>/detail/ — single booking full details."""
    booking = get_object_or_404(
        Booking.objects.select_related('assigned_beautician', 'user').prefetch_related(
            'items__service_variant__service', 'items__package', 'items__review'
        ),
        booking_number=booking_number,
        user=request.user,
    )
    return JsonResponse({'ok': True, 'booking': _serialize_booking(booking)})


@csrf_exempt
@token_required
@require_POST
def booking_item_review_view(request, item_id):
    """POST /api/v1/bookings/items/<item_id>/review/ — rate an item or beautician."""
    item = get_object_or_404(BookingItem, id=item_id, booking__user=request.user, booking__status='completed')

    if not item.service_variant and not item.package:
        return JsonResponse({'ok': False, 'error': 'This service is no longer available to rate.'}, status=400)

    try:
        if request.content_type == 'application/json':
            payload = json.loads(request.body)
        else:
            payload = request.POST
    except Exception:
        payload = {}

    rating_raw = payload.get('rating')
    beautician_rating_raw = payload.get('beautician_rating')

    rating = None
    if rating_raw is not None:
        try:
            val = int(rating_raw)
            if val in range(1, 6):
                rating = val
        except (TypeError, ValueError):
            pass

    beautician_rating = None
    if beautician_rating_raw is not None:
        try:
            val = int(beautician_rating_raw)
            if val in range(1, 6):
                beautician_rating = val
        except (TypeError, ValueError):
            pass

    if rating is None and beautician_rating is None:
        return JsonResponse({'ok': False, 'error': 'Rating must be between 1 and 5 stars.'}, status=400)

    is_package = item.package_id is not None
    reviewed = item.package if is_package else item.service_variant.service

    review, _ = Review.objects.get_or_create(
        booking_item=item,
        defaults={
            'user': request.user,
            'package': reviewed if is_package else None,
            'service': None if is_package else reviewed,
        },
    )

    if rating is not None:
        review.rating = rating
    if beautician_rating is not None:
        review.beautician_rating = beautician_rating
    review.save()

    # Recompute Service / Package aggregate rating
    if rating is not None and reviewed:
        agg = reviewed.reviews.filter(rating__isnull=False).aggregate(avg=Avg('rating'), count=Count('id'))
        reviewed.rating = round(agg['avg'] or 0, 1)
        reviewed.reviews_count = agg['count'] or 0
        reviewed.save(update_fields=['rating', 'reviews_count'])

    # Recompute Beautician (Employee) rating
    beautician = item.booking.assigned_beautician
    if beautician_rating is not None and beautician:
        b_agg = Review.objects.filter(
            booking_item__booking__assigned_beautician=beautician,
            beautician_rating__isnull=False,
        ).aggregate(avg=Avg('beautician_rating'), count=Count('id'))
        if b_agg['count']:
            beautician.rating = round(Decimal(str(b_agg['avg'])), 1)
            beautician.reviews = b_agg['count']
            beautician.save(update_fields=['rating', 'reviews'])

    return JsonResponse({
        'ok': True,
        'rating': rating,
        'beautician_rating': beautician_rating,
    })


@csrf_exempt
@token_required
@require_POST
def booking_feedback_view(request, booking_number):
    """POST /api/v1/bookings/<booking_number>/feedback/ — overall booking feedback comment."""
    booking = get_object_or_404(Booking, booking_number=booking_number, user=request.user, status='completed')
    try:
        if request.content_type == 'application/json':
            payload = json.loads(request.body)
        else:
            payload = request.POST
    except Exception:
        payload = {}

    comment = payload.get('comment', '').strip()
    booking.feedback_comment = comment
    booking.feedback_submitted_at = timezone.now()
    booking.save(update_fields=['feedback_comment', 'feedback_submitted_at'])
    return JsonResponse({'ok': True, 'feedback_comment': comment})


@csrf_exempt
@token_required
@require_POST
def booking_cancel_view(request, booking_number):
    """POST /api/v1/bookings/<booking_number>/cancel/ — cancels booking,
    triggers auto-refund via Razorpay if paid online, and notifies user/admin."""
    booking = get_object_or_404(Booking, booking_number=booking_number, user=request.user)
    if not booking.can_cancel:
        return JsonResponse({
            'ok': False,
            'error': 'This booking can no longer be cancelled — the beautician is already on the way or it’s completed/cancelled.'
        }, status=400)

    booking.status = 'cancelled'
    booking.save(update_fields=['status', 'updated_at'])

    refund_status = None
    refund_message = None

    # Auto-refund for online-paid bookings (matching bookings/views.py::cancel_booking)
    if booking.payment_status == 'paid' and booking.razorpay_payment_id:
        try:
            razorpay_client.create_refund(booking.razorpay_payment_id)
            booking.payment_status = 'refunded'
            booking.save(update_fields=['payment_status'])
            refund_status = 'initiated'
            refund_message = (
                f'Your refund of ₹{booking.total_amount:,.0f} has been initiated '
                f'and will appear in 5–7 business days.'
            )
        except Exception:
            logger.error(
                'Mobile cancel: refund FAILED for booking %s (payment_id=%s) — manual refund needed.',
                booking.booking_number, booking.razorpay_payment_id,
                exc_info=True,
            )
            refund_status = 'failed'
            refund_message = 'Refund could not be processed automatically. Support will issue it manually.'

    # Notifications (email & in-app)
    try:
        send_booking_email_all(
            event_customer='booking_cancelled',
            event_admin='admin_booking_cancelled',
            event_beautician='beautician_job_cancelled' if booking.assigned_beautician_id else None,
            booking=booking,
        )
        notify_user(booking, 'booking_cancelled')
    except Exception:
        logger.exception('Failed sending cancellation notifications for %s', booking.booking_number)

    return JsonResponse({
        'ok': True,
        'message': f'Booking {booking.booking_number} has been cancelled.',
        'refund_status': refund_status,
        'refund_message': refund_message,
        'payment_status': booking.payment_status,
    })


@csrf_exempt
@token_required
@require_POST
def booking_reschedule_view(request, booking_number):
    """POST /api/v1/bookings/<booking_number>/reschedule/ — reschedules booking to new date/slot."""
    from bookings.views import reschedule_booking
    return reschedule_booking(request, booking_number)


@csrf_exempt
@token_required
@require_GET
def booking_invoice_pdf_view(request, booking_number):
    """GET /api/v1/bookings/<booking_number>/invoice/pdf/ — generates and returns PDF receipt."""
    from bookings.invoice import generate_booking_receipt_pdf
    booking = get_object_or_404(Booking, booking_number=booking_number, user=request.user)
    pdf_bytes = generate_booking_receipt_pdf(booking)
    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="receipt-{booking.booking_number}.pdf"'
    return response


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
    raw_pm = payload.get('payment_method')
    payment_method = PAYMENT_METHOD_MAP.get(raw_pm) or (raw_pm if raw_pm in dict(Booking.PAYMENT_METHOD_CHOICES) else None)

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

    scheduled_date = parse_date(payload.get('date') or payload.get('scheduled_date') or '')
    if not scheduled_date:
        return JsonResponse({'ok': False, 'error': 'Invalid date.'}, status=400)
    if scheduled_date < timezone.localdate():
        return JsonResponse({'ok': False, 'error': 'Scheduled date cannot be in the past.'}, status=400)

    time_slot = payload.get('time_slot') or ''
    exact_time = parse_time(payload.get('exact_time') or '') if booking_type == 'urgent' else None
    if booking_type == 'regular' and time_slot not in ('morning', 'afternoon', 'evening'):
        return JsonResponse({'ok': False, 'error': 'Select a time slot.'}, status=400)
    if booking_type == 'urgent' and not exact_time:
        return JsonResponse({'ok': False, 'error': 'Select a time.'}, status=400)

    now_dt = timezone.localtime()
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

    # Auto-assign the best available beautician immediately after booking is confirmed
    assigned = None
    try:
        from bookings.auto_assign import auto_assign_beautician
        assigned = auto_assign_beautician(booking)
        if assigned:
            booking.assigned_beautician = assigned
            booking.save(update_fields=['assigned_beautician', 'beautician_rush_bonus'])
    except Exception:
        logger.exception('auto_assign failed for mobile booking %s — leaving unassigned.', booking.booking_number)

    try:
        send_booking_email_all(
            event_customer='booking_confirmed',
            event_admin='admin_new_booking',
            event_beautician='beautician_new_job' if assigned else None,
            booking=booking,
        )
        notify_user(booking, 'booking_confirmed')
        if assigned:
            notify_user(booking, 'beautician_assigned')
    except Exception:
        logger.exception('Notification dispatch failed for mobile booking %s', booking.booking_number)

    return JsonResponse({'ok': True, 'booking_number': booking.booking_number})


# ─── Phase 4: Razorpay Payment Endpoints ─────────────────────────────────────

import hmac
import hashlib
import razorpay

from django.conf import settings


def _razorpay_client():
    return razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )


@csrf_exempt
@token_required
@require_POST
def razorpay_create_order(request):
    """POST /api/v1/payments/razorpay/create-order/

    Takes the same cart payload as checkout_view but only creates the
    Razorpay order (does NOT create a Booking yet).  The Booking is
    created in razorpay_verify after the payment is confirmed, so we
    never create a booking for a failed payment.

    Request body: {
        "amount_paise": 129900,   # total in paise (e.g. Rs.1299 = 129900)
        "receipt": "cart_<uuid>"  # short unique string, client-generated
    }

    Response: {
        "ok": true,
        "order_id": "order_XXXX",
        "amount":   129900,
        "currency": "INR",
        "key_id":   "rzp_test_..."
    }
    """
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({'ok': False, 'error': 'Invalid request body.'}, status=400)

    amount_paise = payload.get('amount_paise')
    receipt = (payload.get('receipt') or '')[:40]

    if not isinstance(amount_paise, int) or amount_paise <= 0:
        return JsonResponse({'ok': False, 'error': 'Invalid amount.'}, status=400)

    try:
        client = _razorpay_client()
        rzp_order = client.order.create({
            'amount': amount_paise,
            'currency': 'INR',
            'receipt': receipt or f'mobile_{request.user.id}',
            'payment_capture': 1,
        })
    except Exception:
        logger.exception('Razorpay order creation failed for user=%s', request.user.id)
        return JsonResponse({'ok': False, 'error': 'Payment gateway error. Please try again.'}, status=500)

    return JsonResponse({
        'ok': True,
        'order_id': rzp_order['id'],
        'amount': rzp_order['amount'],
        'currency': rzp_order['currency'],
        'key_id': settings.RAZORPAY_KEY_ID,
    })


@csrf_exempt
@token_required
@require_POST
def razorpay_verify(request):
    """POST /api/v1/payments/razorpay/verify/

    Called after the Razorpay SDK fires its success callback on the mobile
    client.  Verifies the HMAC-SHA256 signature, then creates the Booking
    (same logic as checkout_view) and marks payment_status='paid'.

    Request body: {
        "razorpay_order_id":   "order_XXXX",
        "razorpay_payment_id": "pay_XXXX",
        "razorpay_signature":  "<hex>",
        # --- all the same booking fields as checkout_view ---
        "address": {...}, "cart": [...], "date": "...", ...
    }
    """
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({'ok': False, 'error': 'Invalid request body.'}, status=400)

    order_id   = payload.get('razorpay_order_id', '')
    payment_id = payload.get('razorpay_payment_id', '')
    signature  = payload.get('razorpay_signature', '')

    if not (order_id and payment_id and signature):
        return JsonResponse({'ok': False, 'error': 'Missing payment verification fields.'}, status=400)

    # ── Verify HMAC-SHA256 signature ──────────────────────────────────────────
    body_str = f'{order_id}|{payment_id}'
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode('utf-8'),
        body_str.encode('utf-8'),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        logger.warning(
            'Razorpay signature mismatch: user=%s order=%s', request.user.id, order_id
        )
        return JsonResponse({'ok': False, 'error': 'Payment verification failed.'}, status=400)

    # ── Signature valid — create the Booking ─────────────────────────────────
    address      = payload.get('address') or {}
    cart         = payload.get('cart') or []
    booking_type = payload.get('booking_type')
    payment_method = 'razorpay'

    if not address.get('text'):
        return JsonResponse({'ok': False, 'error': 'Address is required.'}, status=400)
    if booking_type not in ('regular', 'urgent'):
        return JsonResponse({'ok': False, 'error': 'Invalid booking type.'}, status=400)

    scheduled_date = parse_date(payload.get('date') or payload.get('scheduled_date') or '')
    if not scheduled_date:
        return JsonResponse({'ok': False, 'error': 'Invalid date.'}, status=400)

    time_slot  = payload.get('time_slot') or ''
    exact_time = parse_time(payload.get('exact_time') or '') if booking_type == 'urgent' else None

    try:
        address_lat = float(address['lat']) if address.get('lat') is not None else None
        address_lng = float(address['lng']) if address.get('lng') is not None else None
    except (TypeError, ValueError):
        address_lat = address_lng = None

    try:
        line_items, subtotal, discount_amount, total_amount, coupon_code = _resolve_cart_pricing(
            cart, payload.get('coupon_code')
        )
    except CartError as exc:
        return JsonResponse({'ok': False, 'error': exc.message}, status=400)

    # Add urgent fee to total if applicable
    urgent_fee = 99 if booking_type == 'urgent' else 0
    total_amount = total_amount + urgent_fee

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
                payment_status='paid',
                subtotal=subtotal,
                discount_amount=discount_amount,
                total_amount=total_amount,
                coupon_code=coupon_code,
                urgent_fee=urgent_fee,
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
        logger.exception('Booking creation after Razorpay verify failed for user=%s.', request.user.id)
        return JsonResponse({
            'ok': False,
            'error': 'Payment received but booking creation failed. Contact support with payment ID: ' + payment_id,
        }, status=500)

    # Auto-assign the best available beautician immediately after booking is confirmed
    assigned = None
    try:
        from bookings.auto_assign import auto_assign_beautician
        assigned = auto_assign_beautician(booking)
        if assigned:
            booking.assigned_beautician = assigned
            booking.save(update_fields=['assigned_beautician', 'beautician_rush_bonus'])
    except Exception:
        logger.exception('auto_assign failed for mobile online booking %s — leaving unassigned.', booking.booking_number)

    try:
        send_booking_email_all(
            event_customer='booking_confirmed',
            event_admin='admin_new_booking',
            event_beautician='beautician_new_job' if assigned else None,
            booking=booking,
        )
        notify_user(booking, 'booking_confirmed')
        if assigned:
            notify_user(booking, 'beautician_assigned')
    except Exception:
        logger.exception('Notification dispatch failed for mobile online booking %s', booking.booking_number)

    return JsonResponse({'ok': True, 'booking_number': booking.booking_number, 'payment_id': payment_id})


# ---------------------------------------------------------------------------
# Google Maps API Endpoints (Shared for Web & Mobile)
# ---------------------------------------------------------------------------

@require_http_methods(['GET'])
def maps_reverse_geocode(request):
    """
    GET /api/v1/maps/reverse-geocode/?lat=...&lng=...
    Uses Google Maps Geocoding API to resolve coordinates to formatted address,
    pincode, locality, and city.
    """
    lat = request.GET.get('lat')
    lng = request.GET.get('lng')
    if not lat or not lng:
        return JsonResponse({'ok': False, 'error': 'Latitude and longitude are required.'}, status=400)

    api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
    if not api_key:
        return JsonResponse({'ok': False, 'error': 'Google Maps API key is not configured.'}, status=500)

    import urllib.request
    import urllib.parse

    url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={api_key}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'GlamourAtHome/1.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        status = data.get('status')
        if status == 'OK' and data.get('results'):
            first = data['results'][0]
            formatted_address = first.get('formatted_address', '')
            pincode = ''
            locality = ''
            for comp in first.get('address_components', []):
                types = comp.get('types', [])
                if 'postal_code' in types and not pincode:
                    pincode = comp.get('long_name', '')
                if ('locality' in types or 'sublocality' in types) and not locality:
                    locality = comp.get('long_name', '')

            return JsonResponse({
                'ok': True,
                'address': formatted_address,
                'pincode': pincode,
                'locality': locality,
                'lat': float(lat),
                'lng': float(lng),
            })
        else:
            err_msg = data.get('error_message') or f"Google Maps returned status {status}"
            return JsonResponse({'ok': False, 'status': status, 'error': err_msg}, status=400)
    except Exception as exc:
        logger.exception("Google Maps geocoding error")
        return JsonResponse({'ok': False, 'error': f'Geocoding request failed: {str(exc)}'}, status=500)


@require_http_methods(['GET'])
def maps_places_autocomplete(request):
    """
    GET /api/v1/maps/places-autocomplete/?input=...
    Uses Google Places API (New) with country:in restriction and legacy fallback.
    """
    query = request.GET.get('input', '').strip()
    if not query:
        return JsonResponse({'ok': True, 'predictions': []})

    api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
    if not api_key:
        return JsonResponse({'ok': False, 'error': 'Google Maps API key is not configured.'}, status=500)

    import urllib.request
    import urllib.parse

    # 1. Try Google Places API (New)
    try:
        new_url = "https://places.googleapis.com/v1/places:autocomplete"
        post_data = json.dumps({
            "input": query,
            "includedRegionCodes": ["in"]
        }).encode('utf-8')
        headers = {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': api_key,
            'User-Agent': 'GlamourAtHome/1.0',
        }
        req = urllib.request.Request(new_url, data=post_data, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        predictions = []
        for s in data.get('suggestions', []):
            pred = s.get('placePrediction', {})
            place_id = pred.get('placeId') or pred.get('place', '').replace('places/', '')
            structured = pred.get('structuredFormat', {})
            main_text = structured.get('mainText', {}).get('text', '')
            secondary_text = structured.get('secondaryText', {}).get('text', '')
            full_text = pred.get('text', {}).get('text', '')

            if place_id:
                predictions.append({
                    'place_id': place_id,
                    'description': full_text or main_text,
                    'main_text': main_text or full_text,
                    'secondary_text': secondary_text,
                })

        return JsonResponse({'ok': True, 'predictions': predictions, 'status': 'OK'})
    except Exception as exc:
        logger.warning("Places API (New) autocomplete error, trying legacy fallback: %s", exc)

    # 2. Legacy Places Autocomplete fallback
    try:
        encoded = urllib.parse.quote(query)
        legacy_url = f"https://maps.googleapis.com/maps/api/place/autocomplete/json?input={encoded}&components=country:in&key={api_key}"
        req = urllib.request.Request(legacy_url, headers={'User-Agent': 'GlamourAtHome/1.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        predictions = []
        for p in data.get('predictions', []):
            predictions.append({
                'place_id': p.get('place_id'),
                'description': p.get('description'),
                'main_text': p.get('structured_formatting', {}).get('main_text', ''),
                'secondary_text': p.get('structured_formatting', {}).get('secondary_text', ''),
            })
        return JsonResponse({'ok': True, 'predictions': predictions, 'status': data.get('status')})
    except Exception as exc:
        logger.exception("Google Places autocomplete error")
        return JsonResponse({'ok': False, 'error': str(exc)}, status=500)


@require_http_methods(['GET'])
def maps_place_details(request):
    """
    GET /api/v1/maps/place-details/?place_id=...
    Resolves place_id to lat, lng, formatted_address, and pincode using Places API (New) / Legacy.
    """
    place_id = request.GET.get('place_id', '').strip()
    if not place_id:
        return JsonResponse({'ok': False, 'error': 'place_id is required.'}, status=400)

    api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
    if not api_key:
        return JsonResponse({'ok': False, 'error': 'Google Maps API key is not configured.'}, status=500)

    import urllib.request
    import urllib.parse
    import re

    # 1. Try Google Places API (New) details
    try:
        clean_id = place_id.replace('places/', '')
        new_url = f"https://places.googleapis.com/v1/places/{clean_id}?fields=id,displayName,formattedAddress,location&key={api_key}"
        headers = {'User-Agent': 'GlamourAtHome/1.0'}
        req = urllib.request.Request(new_url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        formatted_address = data.get('formattedAddress', '')
        loc = data.get('location', {})
        lat = loc.get('latitude')
        lng = loc.get('longitude')

        pincode = ''
        pin_match = re.search(r'\b(4\d{5})\b', formatted_address)
        if pin_match:
            pincode = pin_match.group(1)

        if formatted_address and lat is not None and lng is not None:
            return JsonResponse({
                'ok': True,
                'address': formatted_address,
                'pincode': pincode,
                'lat': lat,
                'lng': lng,
            })
    except Exception as exc:
        logger.warning("Places API (New) details failed, trying legacy fallback: %s", exc)

    # 2. Legacy Places Details fallback
    try:
        encoded_id = urllib.parse.quote(place_id)
        legacy_url = f"https://maps.googleapis.com/maps/api/place/details/json?place_id={encoded_id}&fields=formatted_address,geometry,address_components&key={api_key}"
        req = urllib.request.Request(legacy_url, headers={'User-Agent': 'GlamourAtHome/1.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        result = data.get('result', {})
        loc = result.get('geometry', {}).get('location', {})
        pincode = ''
        for comp in result.get('address_components', []):
            if 'postal_code' in comp.get('types', []):
                pincode = comp.get('long_name', '')
                break

        return JsonResponse({
            'ok': True,
            'address': result.get('formatted_address', ''),
            'pincode': pincode,
            'lat': loc.get('lat'),
            'lng': loc.get('lng'),
        })
    except Exception as exc:
        logger.exception("Google Places details error")
        return JsonResponse({'ok': False, 'error': str(exc)}, status=500)


@require_http_methods(['GET'])
def maps_search_nearby(request):
    """
    GET /api/v1/maps/nearby/?lat=...&lng=...&radius=...
    Searches nearby places, landmarks, and localities around given coordinates using
    Google Places API (New) searchNearby.
    """
    lat = request.GET.get('lat')
    lng = request.GET.get('lng')
    radius = float(request.GET.get('radius') or 2000.0)

    try:
        lat = float(lat) if lat else 22.7196
        lng = float(lng) if lng else 75.8577
    except (TypeError, ValueError):
        lat, lng = 22.7196, 75.8577

    api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
    if not api_key:
        return JsonResponse({'ok': False, 'error': 'Google Maps API key is not configured.'}, status=500)

    import urllib.request
    import re

    try:
        url = "https://places.googleapis.com/v1/places:searchNearby"
        post_data = json.dumps({
            "locationRestriction": {
                "circle": {
                    "center": {
                        "latitude": lat,
                        "longitude": lng,
                    },
                    "radius": min(max(radius, 500.0), 10000.0)
                }
            },
            "maxResultCount": 10
        }).encode('utf-8')
        headers = {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': api_key,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.types',
            'User-Agent': 'GlamourAtHome/1.0',
        }
        req = urllib.request.Request(url, data=post_data, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        places = []
        for p in data.get('places', []):
            name = p.get('displayName', {}).get('text', '')
            addr = p.get('formattedAddress', '')
            loc = p.get('location', {})
            types = p.get('types', [])
            pincode = ''
            pin_match = re.search(r'\b(4\d{5})\b', addr)
            if pin_match:
                pincode = pin_match.group(1)

            if name:
                places.append({
                    'name': name,
                    'address': addr or name,
                    'pincode': pincode,
                    'lat': loc.get('latitude'),
                    'lng': loc.get('longitude'),
                    'types': types,
                })

        return JsonResponse({'ok': True, 'places': places})
    except Exception as exc:
        logger.exception("Google Places searchNearby error")
        return JsonResponse({'ok': False, 'error': str(exc)}, status=500)

