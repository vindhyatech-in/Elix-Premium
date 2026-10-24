import hashlib
import hmac
import json
import logging
import time
from decimal import Decimal

import razorpay
from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

logger = logging.getLogger(__name__)


def _parse_request_payload(request):
    """
    Parses request body as JSON or falls back to POST form data.
    Returns a dictionary of parameters.
    """
    if request.body:
        try:
            return json.loads(request.body.decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass
    return request.POST.dict()


@csrf_exempt
@require_http_methods(['POST'])
def create_order(request):
    """
    STEP 1: BACKEND - Create Order
    Endpoint: POST /api/create-order
    Call Razorpay API: POST https://api.razorpay.com/v1/orders
    Request: { amount (paise), currency, receipt }
    Return: { order_id, amount, currency, key_id }
    Minimum amount: 100 paise (Rs. 1.00)
    """
    key_id = getattr(settings, 'RAZORPAY_KEY_ID', None)
    key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', None)

    if not key_id or not key_secret:
        logger.error('Razorpay credentials are not configured in settings.')
        return JsonResponse({
            'ok': False,
            'error': 'Razorpay authentication failed: Credentials not configured.'
        }, status=401)

    payload = _parse_request_payload(request)
    if not payload:
        return JsonResponse({
            'ok': False,
            'error': 'Invalid request: Request body must be non-empty JSON or form data.'
        }, status=400)

    # Accept amount or amount_paise
    raw_amount = payload.get('amount')
    if raw_amount is None:
        raw_amount = payload.get('amount_paise')

    if raw_amount is None:
        return JsonResponse({
            'ok': False,
            'error': 'Missing required parameter: amount (in paise).'
        }, status=400)

    try:
        amount_paise = int(Decimal(str(raw_amount)))
    except (ValueError, TypeError, ArithmeticError):
        return JsonResponse({
            'ok': False,
            'error': 'Invalid amount: Must be an integer number of paise.'
        }, status=400)

    # Validate amount >= 100 paise
    if amount_paise < 100:
        return JsonResponse({
            'ok': False,
            'error': 'Invalid amount: Minimum amount is 100 paise (Rs. 1.00).'
        }, status=400)

    currency = (payload.get('currency') or 'INR').upper()
    receipt = str(payload.get('receipt') or f'rcpt_{int(time.time())}')[:40]

    try:
        client = razorpay.Client(auth=(key_id, key_secret))
        order_data = {
            'amount': amount_paise,
            'currency': currency,
            'receipt': receipt,
            'payment_capture': 1,
        }
        order = client.order.create(data=order_data)

        logger.info('Created Razorpay order %s for %s paise', order.get('id'), amount_paise)
        return JsonResponse({
            'ok': True,
            'order_id': order['id'],
            'amount': order['amount'],
            'currency': order['currency'],
            'key_id': key_id,
        })
    except razorpay.errors.BadRequestError as exc:
        msg = str(exc)
        logger.warning('Razorpay BadRequestError: %s', msg)
        if 'Authentication failed' in msg or 'Unauthorized' in msg:
            return JsonResponse({'ok': False, 'error': 'Payment gateway authentication failed.'}, status=401)
        return JsonResponse({'ok': False, 'error': f'Razorpay API error: {msg}'}, status=500)
    except Exception as exc:
        logger.exception('Failed to create Razorpay order: %s', exc)
        return JsonResponse({'ok': False, 'error': f'Payment gateway error: {str(exc)}'}, status=500)


@csrf_exempt
@require_http_methods(['POST'])
def verify_payment(request):
    """
    STEP 3: BACKEND - Verify Signature
    Endpoint: POST /api/verify-payment
    Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    Compare generated signature with razorpay_signature
    Return success only if signatures match
    """
    key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', None)
    if not key_secret:
        logger.error('Razorpay key secret is not configured.')
        return JsonResponse({'ok': False, 'error': 'Razorpay key secret not configured.'}, status=401)

    payload = _parse_request_payload(request)
    if not payload:
        return JsonResponse({'ok': False, 'error': 'Missing request payload.'}, status=400)

    order_id = (payload.get('razorpay_order_id') or '').strip()
    payment_id = (payload.get('razorpay_payment_id') or '').strip()
    signature = (payload.get('razorpay_signature') or '').strip()

    # Missing fields check
    if not order_id or not payment_id or not signature:
        missing = []
        if not order_id:
            missing.append('razorpay_order_id')
        if not payment_id:
            missing.append('razorpay_payment_id')
        if not signature:
            missing.append('razorpay_signature')
        return JsonResponse({
            'ok': False,
            'error': f"Missing required fields: {', '.join(missing)}."
        }, status=400)

    # Compute HMAC-SHA256 signature
    message = f'{order_id}|{payment_id}'.encode('utf-8')
    generated_signature = hmac.new(
        key_secret.encode('utf-8'),
        message,
        hashlib.sha256
    ).hexdigest()

    # Compare generated signature with razorpay_signature
    if not hmac.compare_digest(generated_signature, signature):
        logger.warning(
            'Razorpay signature verification failed for order %s and payment %s',
            order_id, payment_id
        )
        return JsonResponse({
            'ok': False,
            'status': 'failed',
            'error': 'Signature verification failed. Payment was not authenticated.'
        }, status=400)

    logger.info('Razorpay payment %s for order %s successfully verified.', payment_id, order_id)
    return JsonResponse({
        'ok': True,
        'status': 'success',
        'message': 'Payment verified successfully.',
        'order_id': order_id,
        'payment_id': payment_id,
    })


def checkout_page(request):
    """
    STEP 2: FRONTEND - Checkout Page
    Renders the web checkout interface with Razorpay Standard Checkout modal.
    """
    key_id = getattr(settings, 'RAZORPAY_KEY_ID', '')
    return render(request, 'checkout.html', {
        'RAZORPAY_KEY_ID': key_id,
    })
