import os
import re

from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.core.validators import URLValidator
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from PIL import Image, UnidentifiedImageError

PHONE_DIGITS_RE = re.compile(r'\d')

ADMIN_LIST_PAGE_SIZE = 10
ADMIN_LIST_PAGE_SIZE_CHOICES = (10, 20, 50)

# Verification/face-reference photos are phone-camera shots, not scans —
# 8MB comfortably covers even a high-res shot with room to spare while
# still rejecting an obviously-wrong upload (e.g. a video file).
MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024

ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'}


def get_object_or_404_safe(model_or_queryset, id_value, **kwargs):
    """
    Same as Django's get_object_or_404, but for the extremely common
    `get_object_or_404(Model, id=request.POST.get('x_id'), **kwargs)`
    pattern — that helper only catches DoesNotExist, not the ValueError a
    non-numeric/garbage id (a stale bookmark, a tampered form field, a
    typo) raises when Django tries to cast it for the lookup, which was
    reaching callers as an uncaught 500 instead of the same clean 404
    used for "no such row".
    """
    try:
        pk = int(id_value)
    except (TypeError, ValueError):
        model_name = getattr(model_or_queryset, '_meta', None)
        label = model_name.verbose_name if model_name else 'object'
        raise Http404(f'Invalid {label} id.')
    return get_object_or_404(model_or_queryset, id=pk, **kwargs)


def parse_money(raw, label, required=True):
    """
    Shared price/MRP parsing — every call site that used a bare
    float(raw) had no try/except (a non-numeric submission 500'd) and no
    floor (₹0 or negative silently saved). Returns (value_or_None,
    error_or_None); error is None and value is None when the field was
    legitimately left blank and required=False.
    """
    if not raw:
        return (None, None) if not required else (None, f'{label} is required.')
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None, f'{label} must be a valid number.'
    if value <= 0:
        return None, f'{label} must be greater than zero.'
    return value, None


def parse_duration(raw, label='Duration', default=None):
    """Whole minutes, 1–600 (10 hours — generous upper bound against fat-finger/garbage input)."""
    if not raw:
        if default is not None:
            return default, None
        return None, f'{label} is required.'
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None, f'{label} must be a whole number of minutes.'
    if not (0 < value <= 600):
        return None, f'{label} must be between 1 and 600 minutes.'
    return value, None


def looks_like_phone(value):
    """Loose sanity check, not a strict format — just enough to catch
    obviously-garbage input ("call me!") without rejecting real numbers
    that include +/spaces/dashes/parens."""
    digits = PHONE_DIGITS_RE.findall(value or '')
    return 7 <= len(digits) <= 15


def paginate_queryset(request, queryset, per_page=ADMIN_LIST_PAGE_SIZE):
    """
    Shared list-view pagination for the admin dashboard. Returns
    (page_obj, other_params) — other_params is the current querystring
    with `page` (and `per_page`, carried separately — see
    partials/pagination.html's page-size <select>) stripped out, so a
    template can build page links that still carry forward whatever
    filters/search/sort are active (`?{{ other_params }}&page=2`).
    `get_page` clamps a missing/non-numeric/out-of-range page instead of
    404ing, since a stale bookmark or a manually-edited `?page=`
    shouldn't break the page.

    `?per_page=` overrides the default page size — restricted to
    ADMIN_LIST_PAGE_SIZE_CHOICES so a manually-edited querystring can't
    request an arbitrarily huge page (a cheap, unintentional DoS vector)
    or a non-numeric value that would just 500 the Paginator.
    """
    requested_per_page = request.GET.get('per_page')
    if requested_per_page:
        try:
            requested_per_page = int(requested_per_page)
        except ValueError:
            requested_per_page = None
        if requested_per_page not in ADMIN_LIST_PAGE_SIZE_CHOICES:
            requested_per_page = None
    per_page = requested_per_page or per_page

    paginator = Paginator(queryset, per_page)
    page_obj = paginator.get_page(request.GET.get('page'))
    other_params = request.GET.copy()
    other_params.pop('page', None)
    other_params.pop('per_page', None)
    return page_obj, other_params.urlencode()


def validate_url(value, label='URL'):
    """Friendly wrapper around Django's own URLValidator — returns an
    error message, or None if `value` is blank (an empty "image URL"
    field is just "not provided", not invalid) or a well-formed URL."""
    if not value:
        return None
    try:
        URLValidator()(value)
    except ValidationError:
        return f'{label} must be a valid URL.'
    return None


def generate_unique_slug(model, name, max_length=50):
    """
    Collision-safe slug for any model with a unique `slug` field — same
    "name, lowercased, collision-suffixed with an incrementing number"
    scheme dashboard_services' add_service already used inline for
    Service.slug (extracted here so dashboard_categories' add_category
    doesn't copy-paste it a second time). Uses Django's own `slugify`
    rather than a hand-rolled character replace, which — unlike the
    original inline version — actually strips punctuation (`&`, `'`, …)
    instead of leaving it in an otherwise-invalid slug.
    """
    base = slugify(name)[:max_length] or 'item'
    slug = base
    suffix_num = 1
    while model.objects.filter(slug=slug).exists():
        suffix_num += 1
        suffix = f'-{suffix_num}'
        slug = f'{base[:max_length - len(suffix)]}{suffix}'
    return slug


def validate_image_upload(uploaded_file):
    """
    Direct model-attribute assignment (`obj.field = request.FILES[...]`)
    never runs the Pillow-based "is this really an image" check an
    ImageField's form field would — these dashboards assign files
    straight from request.FILES with no form in between. Returns an
    error message, or None if the upload is acceptable.

    Checks three independent things, since any one alone is spoofable:
    the multipart Content-Type header (attacker-controlled — a plain
    `<script>` file can claim "image/jpeg"), the filename's extension
    (also attacker-chosen), and — the one that actually matters — Pillow
    decoding the real file bytes as a genuine image. Saving something
    named e.g. "x.html" with real HTML content would otherwise get
    served back as text/html from MEDIA_URL on this same origin: a
    stored-XSS vector, not just a "wrong file type" nuisance.
    """
    if uploaded_file.size > MAX_IMAGE_UPLOAD_BYTES:
        return f'File too large — max {MAX_IMAGE_UPLOAD_BYTES // (1024 * 1024)}MB.'

    content_type = (uploaded_file.content_type or '').lower()
    if not content_type.startswith('image/'):
        return 'Only image files are accepted.'

    ext = os.path.splitext(uploaded_file.name or '')[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return 'Only JPG, PNG, WEBP, or HEIC images are accepted.'

    try:
        Image.open(uploaded_file).verify()
    except (UnidentifiedImageError, OSError):
        return 'This file is not a valid image.'
    finally:
        uploaded_file.seek(0)

    return None
