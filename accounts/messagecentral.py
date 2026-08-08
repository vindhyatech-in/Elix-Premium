import base64
import json
import secrets

import requests
from django.conf import settings
from django.core.cache import cache

BASE_URL = 'https://cpaas.messagecentral.com'

# The session token from /auth/v1/authentication/token isn't documented
# with an exact TTL — cached for a while so send/validate don't each pay
# for a fresh token-generation round trip, but short enough that a
# password rotation or account change doesn't leave a stale cached token
# silently failing for hours.
_TOKEN_CACHE_KEY = 'messagecentral_session_token'
_TOKEN_CACHE_SECONDS = 60 * 60 * 6

# settings.OTP_GATEWAY toggles between the real MessageCentral API (True)
# and a local console-printed code (False) — same "print to console
# instead of spending real credits" pattern already used elsewhere in
# this project (email backend, the earlier MSG91 dev fallback). Off by
# default so local dev/testing never silently burns real OTP sends.
# Console mode generates and stores its own code (MessageCentral never
# hands the actual code back to us even in gateway mode — they generate
# and check it entirely on their side), so it needs its own storage
# rather than reusing anything from the real flow.
_CONSOLE_CODE_CACHE_PREFIX = 'messagecentral_console_code_'
_CONSOLE_CODE_TTL_SECONDS = 60 * 5


class MessageCentralError(Exception):
    """MessageCentral's API itself reported failure (bad auth, invalid phone, expired code, etc.)."""


def _customer_id():
    """
    The dashboard's "Auth Token" (MESSAGECENTRAL_AUTH_TOKEN) is itself a
    JWT carrying the customerId (`client_company_name`, e.g.
    "C-27481422C22E472" — the same format the dashboard shows next to
    it) in its payload, so it doesn't need a second .env value that
    would just duplicate what's already inside that token.
    """
    token = settings.MESSAGECENTRAL_AUTH_TOKEN
    payload_b64 = token.split('.')[1]
    padded = payload_b64 + '=' * (-len(payload_b64) % 4)
    return json.loads(base64.urlsafe_b64decode(padded))['client_company_name']


def _local_number(phone, country_code='91'):
    digits = phone.lstrip('+')
    if digits.startswith(country_code):
        digits = digits[len(country_code):]
    return digits


def _raise_with_body(response):
    """requests' own raise_for_status() message doesn't include the
    response body, which is where MessageCentral actually explains what
    went wrong on a 4xx/5xx — surface that instead of a bare "401 Client
    Error" with nothing actionable in it."""
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise MessageCentralError(f'{exc} — response body: {response.text[:500]}') from exc


def _generate_session_token(force_refresh=False):
    """
    Per MessageCentral's own "VerifyNow" onboarding guide: send/validate
    need a session token from this endpoint first — the dashboard's
    static "Auth Token" is a different kind of credential (no
    expiry/session claims) and can't be used directly there. `key` is
    the account's login password, base64-encoded by us before sending
    (their docs: "Base-64 encrypted password").
    """
    if not force_refresh:
        cached = cache.get(_TOKEN_CACHE_KEY)
        if cached:
            return cached

    key_b64 = base64.b64encode(settings.MESSAGECENTRAL_PASSWORD.encode()).decode()
    response = requests.get(
        f'{BASE_URL}/auth/v1/authentication/token',
        params={'customerId': _customer_id(), 'key': key_b64, 'scope': 'NEW', 'country': '91'},
        headers={'accept': '*/*'},
        timeout=10,
    )
    _raise_with_body(response)
    data = response.json()
    token = data.get('token')
    if not token:
        raise MessageCentralError(f'No session token in response: {data}')
    cache.set(_TOKEN_CACHE_KEY, token, _TOKEN_CACHE_SECONDS)
    return token


def _request_with_token_retry(method, url, **kwargs):
    """
    Runs one request with the cached session token; if MessageCentral
    itself rejects it as unauthorized, generates a fresh one and retries
    exactly once — covers a cached token expiring server-side before our
    local TTL guess does, without a customer-facing failure for it.
    """
    base_headers = kwargs.pop('headers', {})
    token = _generate_session_token()
    response = requests.request(method, url, headers={**base_headers, 'authToken': token}, **kwargs)
    if response.status_code == 401:
        token = _generate_session_token(force_refresh=True)
        response = requests.request(method, url, headers={**base_headers, 'authToken': token}, **kwargs)
    return response


def send_otp(phone, country_code='91'):
    """
    Starts a MessageCentral-hosted phone verification — they generate
    and deliver the OTP themselves (unlike MSG91, there's no "our own
    code, they just relay it" step). Returns the verificationId needed
    to confirm it in validate_otp().
    """
    if not settings.OTP_GATEWAY:
        code = ''.join(secrets.choice('0123456789') for _ in range(6))
        verification_id = f'console-{secrets.token_hex(8)}'
        cache.set(f'{_CONSOLE_CODE_CACHE_PREFIX}{verification_id}', code, _CONSOLE_CODE_TTL_SECONDS)
        print(f'[DEV OTP] {phone}: {code}')
        return verification_id

    response = _request_with_token_retry(
        'POST',
        f'{BASE_URL}/verification/v3/send',
        params={
            'countryCode': country_code,
            'mobileNumber': _local_number(phone, country_code),
            'flowType': 'SMS',
            'otpLength': 6,
        },
        headers={'accept': '*/*'},
        timeout=10,
    )
    _raise_with_body(response)
    payload = response.json()
    data = payload.get('data') or {}
    if payload.get('responseCode') != 200 or data.get('errorMessage'):
        raise MessageCentralError(data.get('errorMessage') or payload.get('message') or 'Failed to send OTP.')
    return data['verificationId']


def validate_otp(verification_id, code):
    """
    Returns True iff `code` is the correct, still-valid OTP for that
    verificationId. MessageCentral's own docs label this endpoint POST,
    but their own example cURL uses GET and their gateway agrees — a
    POST here (or a trailing slash on the path) gets a blank 401 before
    ever reaching application logic; confirmed directly against the live
    API, not just going by the (self-contradictory) docs.
    """
    if not settings.OTP_GATEWAY:
        cache_key = f'{_CONSOLE_CODE_CACHE_PREFIX}{verification_id}'
        expected = cache.get(cache_key)
        if expected and expected == code:
            cache.delete(cache_key)
            return True
        return False

    response = _request_with_token_retry(
        'GET',
        f'{BASE_URL}/verification/v3/validateOtp',
        params={'verificationId': verification_id, 'code': code, 'flowType': 'SMS'},
        headers={'accept': '*/*'},
        timeout=10,
    )
    _raise_with_body(response)
    data = response.json().get('data') or {}
    return data.get('verificationStatus') == 'VERIFICATION_COMPLETED'
