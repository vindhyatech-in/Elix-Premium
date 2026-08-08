import base64
import hashlib
import hmac

import requests
from django.conf import settings

BASE_URL = 'https://api.razorpay.com/v1'


class RazorpayError(Exception):
    """Razorpay's API itself reported failure (bad auth, invalid amount, etc.)."""


def _auth_header():
    creds = f'{settings.RAZORPAY_KEY_ID}:{settings.RAZORPAY_KEY_SECRET}'
    return 'Basic ' + base64.b64encode(creds.encode()).decode()


def create_order(amount_paise, receipt):
    """Creates a Razorpay Order — required before the Checkout.js modal can
    open. `payment_capture: 1` auto-captures on success instead of leaving
    the payment merely "authorized" (which would need a separate capture
    call before the money actually settles)."""
    response = requests.post(
        f'{BASE_URL}/orders',
        json={'amount': amount_paise, 'currency': 'INR', 'receipt': receipt, 'payment_capture': 1},
        headers={'Authorization': _auth_header()},
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()
    if 'id' not in data:
        raise RazorpayError(data.get('error', {}).get('description') or 'Failed to create order.')
    return data


def fetch_order(order_id):
    """Re-fetches an order's authoritative amount straight from Razorpay —
    used to confirm what was actually paid matches what we expect,
    without trusting anything the client sent about the order."""
    response = requests.get(f'{BASE_URL}/orders/{order_id}', headers={'Authorization': _auth_header()}, timeout=10)
    response.raise_for_status()
    return response.json()


def verify_payment_signature(order_id, payment_id, signature):
    """HMAC-SHA256(order_id + '|' + payment_id, key_secret) — Razorpay's
    documented way to prove a successful-payment callback actually came
    from them and wasn't forged/replayed by tampering with the browser's
    JS response before it reached our server."""
    body = f'{order_id}|{payment_id}'.encode()
    expected = hmac.new(settings.RAZORPAY_KEY_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or '')
