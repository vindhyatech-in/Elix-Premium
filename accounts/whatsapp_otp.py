import logging
import re
import secrets

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

CACHE_PREFIX = 'wa_otp_'
OTP_EXPIRY_SECONDS = 60 * 10  # 10 minutes (matches Meta template expiry)


class WhatsAppAPIError(Exception):
    """Raised when Meta's WhatsApp Cloud API rejects a template message request."""


def clean_phone_number(phone: str, country_code: str = '91') -> str:
    """
    Normalizes a phone number to E.164 digits without a leading '+'.
    Example: '+91 98765-43210' -> '919876543210'.
    A 10-digit Indian number '9876543210' has '91' automatically prepended.
    """
    digits = re.sub(r'\D', '', str(phone or ''))
    if digits.startswith('0'):
        digits = digits.lstrip('0')
    if len(digits) == 10 and digits[0] in '6789':
        digits = f'{country_code}{digits}'
    return digits


def _build_payload(phone_number: str, code: str, purpose: str = 'Login to Elix Premium Salon') -> dict:
    """Builds the WhatsApp Cloud API template payload for the authentication template."""
    template_name = getattr(settings, 'WHATSAPP_TEMPLATE_NAME', 'login_otp')
    template_lang = getattr(settings, 'WHATSAPP_TEMPLATE_LANG', 'en_US')

    return {
        'messaging_product': 'whatsapp',
        'recipient_type': 'individual',
        'to': phone_number,
        'type': 'template',
        'template': {
            'name': template_name,
            'language': {
                'code': template_lang,
            },
            'components': [
                {
                    'type': 'body',
                    'parameters': [
                        {'type': 'text', 'text': str(code)},
                        {'type': 'text', 'text': str(purpose)},
                    ],
                },
                {
                    'type': 'button',
                    'sub_type': 'url',
                    'index': '0',
                    'parameters': [
                        {'type': 'text', 'text': str(code)},
                    ],
                },
            ],
        },
    }


def _dispatch_meta_message(phone_number: str, code: str, purpose: str = 'Login to Elix Premium Salon') -> dict:
    """POSTs the template message to Meta Graph API."""
    token = getattr(settings, 'WHATSAPP_ACCESS_TOKEN', '')
    phone_id = getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', '')
    api_version = getattr(settings, 'WHATSAPP_API_VERSION', 'v20.0')

    if not token or not phone_id:
        raise WhatsAppAPIError(
            'WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not configured in settings/.env.'
        )

    url = f'https://graph.facebook.com/{api_version}/{phone_id}/messages'
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }

    payload = _build_payload(phone_number, code, purpose=purpose)
    response = requests.post(url, json=payload, headers=headers, timeout=12)

    try:
        data = response.json()
    except Exception:
        data = {'raw': response.text}

    if response.status_code not in (200, 201):
        err = data.get('error', {})
        message = err.get('message') or err.get('error_user_msg') or response.text[:400]
        code_num = err.get('code')
        subcode = err.get('error_subcode')
        raise WhatsAppAPIError(
            f'Meta WhatsApp API error (HTTP {response.status_code}, code={code_num}, subcode={subcode}): {message}'
        )

    return data


def send_otp(phone: str, purpose: str = 'Login to Elix Premium Salon') -> str:
    """
    Generates a secure 6-digit OTP, stores it in Django cache, and sends
    it via Meta WhatsApp Cloud API.

    Returns:
        verification_id (str): A unique token identifying this OTP session.
    """
    clean_number = clean_phone_number(phone)
    if not clean_number:
        raise WhatsAppAPIError('Invalid phone number provided.')

    # Cryptographically secure 6-digit numeric OTP
    code = f'{secrets.randbelow(1_000_000):06d}'
    verification_id = f'wa-{secrets.token_hex(8)}'

    # Cache payload with 10-minute expiry
    cache_key = f'{CACHE_PREFIX}{verification_id}'
    cache.set(
        cache_key,
        {
            'code': code,
            'phone': clean_number,
        },
        timeout=OTP_EXPIRY_SECONDS,
    )

    is_gateway_enabled = getattr(settings, 'OTP_GATEWAY', False)
    token = getattr(settings, 'WHATSAPP_ACCESS_TOKEN', '').strip()

    # Local development fallback if gateway is off or access token is empty
    if not is_gateway_enabled or not token:
        logger.info('[DEV WHATSAPP OTP] %s -> %s (verification_id=%s)', clean_number, code, verification_id)
        print(f'[DEV WHATSAPP OTP] Phone: {clean_number} | Code: {code} | Verification ID: {verification_id}')
        return verification_id

    # Live delivery via Meta WhatsApp Cloud API
    try:
        resp = _dispatch_meta_message(clean_number, code, purpose=purpose)
        messages_sent = resp.get('messages', [])
        wa_id = messages_sent[0].get('id') if messages_sent else 'sent'
        logger.info('WhatsApp OTP successfully dispatched to %s (wa_id=%s)', clean_number, wa_id)
    except Exception as exc:
        logger.exception('Failed to dispatch WhatsApp OTP to %s: %s', clean_number, exc)
        raise

    return verification_id


def validate_otp(verification_id: str, code: str) -> bool:
    """
    Validates the user-submitted code in constant time.
    Deletes the cache entry upon successful match to prevent replay.
    """
    if not verification_id or not code:
        return False

    cache_key = f'{CACHE_PREFIX}{verification_id}'
    stored = cache.get(cache_key)
    if not stored or not isinstance(stored, dict):
        return False

    expected_code = str(stored.get('code', '')).strip()
    submitted_code = str(code).strip()

    if secrets.compare_digest(expected_code, submitted_code):
        cache.delete(cache_key)
        return True

    return False
