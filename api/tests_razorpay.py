import hashlib
import hmac
import json
from unittest.mock import MagicMock, patch

from django.conf import settings
from django.test import Client, TestCase


class RazorpayStandardCheckoutTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.key_id = settings.RAZORPAY_KEY_ID
        self.key_secret = settings.RAZORPAY_KEY_SECRET

    # ── STEP 1: CREATE ORDER TESTS ───────────────────────────────────────────

    @patch('razorpay.Client')
    def test_create_order_success(self, mock_razorpay_class):
        mock_instance = MagicMock()
        mock_instance.order.create.return_value = {
            'id': 'order_test_12345',
            'amount': 50000,
            'currency': 'INR',
            'status': 'created',
        }
        mock_razorpay_class.return_value = mock_instance

        response = self.client.post(
            '/api/create-order',
            data=json.dumps({'amount': 50000, 'currency': 'INR', 'receipt': 'rcpt_001'}),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['ok'])
        self.assertEqual(data['order_id'], 'order_test_12345')
        self.assertEqual(data['amount'], 50000)
        self.assertEqual(data['currency'], 'INR')
        self.assertEqual(data['key_id'], self.key_id)

    def test_create_order_minimum_amount_failure(self):
        # Must be at least 100 paise
        response = self.client.post(
            '/api/create-order',
            data=json.dumps({'amount': 50, 'currency': 'INR'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data['ok'])
        self.assertIn('Minimum amount is 100 paise', data['error'])

    def test_create_order_missing_amount(self):
        response = self.client.post(
            '/api/create-order',
            data=json.dumps({'currency': 'INR'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data['ok'])
        self.assertIn('Missing required parameter: amount', data['error'])

    # ── STEP 3: VERIFY PAYMENT SIGNATURE TESTS ────────────────────────────────

    def test_verify_payment_signature_success(self):
        order_id = 'order_test_valid_123'
        payment_id = 'pay_test_valid_456'
        body = f'{order_id}|{payment_id}'.encode('utf-8')
        valid_signature = hmac.new(
            self.key_secret.encode('utf-8'),
            body,
            hashlib.sha256
        ).hexdigest()

        response = self.client.post(
            '/api/verify-payment',
            data=json.dumps({
                'razorpay_order_id': order_id,
                'razorpay_payment_id': payment_id,
                'razorpay_signature': valid_signature,
            }),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['ok'])
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['order_id'], order_id)
        self.assertEqual(data['payment_id'], payment_id)

    def test_verify_payment_signature_mismatch(self):
        order_id = 'order_test_123'
        payment_id = 'pay_test_456'
        invalid_signature = 'fake_tampered_signature_hex'

        response = self.client.post(
            '/api/verify-payment',
            data=json.dumps({
                'razorpay_order_id': order_id,
                'razorpay_payment_id': payment_id,
                'razorpay_signature': invalid_signature,
            }),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data['ok'])
        self.assertIn('Signature verification failed', data['error'])

    def test_verify_payment_missing_fields(self):
        response = self.client.post(
            '/api/verify-payment',
            data=json.dumps({
                'razorpay_order_id': 'order_123',
                # missing razorpay_payment_id and razorpay_signature
            }),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data['ok'])
        self.assertIn('Missing required fields', data['error'])

    # ── STEP 2: CHECKOUT PAGE TEST ───────────────────────────────────────────

    def test_checkout_page_renders(self):
        response = self.client.get('/checkout/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'https://checkout.razorpay.com/v1/checkout.js')
        self.assertContains(response, 'with Razorpay')
        self.assertContains(response, self.key_id)

    # ── WEBHOOK & REFUND TESTS ───────────────────────────────────────────────

    def test_webhook_payment_captured(self):
        from django.contrib.auth import get_user_model
        from django.utils import timezone
        from bookings.models import Booking

        User = get_user_model()
        user = User.objects.create_user(username='test_webhook_user', email='test@example.com')

        booking = Booking.objects.create(
            user=user,
            address_label='Home',
            address_text='123 Test Street',
            scheduled_date=timezone.localdate(),
            booking_type='regular',
            time_slot='morning',
            payment_method='pay_now',
            payment_status='pending',
            razorpay_order_id='order_webhook_test_123',
            subtotal=1000,
            discount_amount=0,
            total_amount=1000,
        )

        payload = {
            'event': 'payment.captured',
            'payload': {
                'payment': {
                    'entity': {
                        'id': 'pay_webhook_test_999',
                        'order_id': 'order_webhook_test_123',
                        'amount': 100000,
                        'currency': 'INR',
                    }
                }
            }
        }
        raw_body = json.dumps(payload).encode('utf-8')
        secret = 'test_webhook_secret'

        with self.settings(RAZORPAY_WEBHOOK_SECRET=secret):
            signature = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
            response = self.client.post(
                '/booking/webhook/razorpay/',
                data=raw_body,
                content_type='application/json',
                HTTP_X_RAZORPAY_SIGNATURE=signature,
            )
            self.assertEqual(response.status_code, 200)

        booking.refresh_from_db()
        self.assertEqual(booking.payment_status, 'paid')
        self.assertEqual(booking.razorpay_payment_id, 'pay_webhook_test_999')

    @patch('bookings.razorpay_client.create_refund')
    def test_mobile_cancel_triggers_refund_for_paid_booking(self, mock_refund):
        from django.contrib.auth import get_user_model
        from django.utils import timezone
        from bookings.models import Booking
        from api.models import AuthToken

        User = get_user_model()
        user = User.objects.create_user(username='test_refund_user', email='refund@example.com')
        token = AuthToken.objects.create(user=user)

        booking = Booking.objects.create(
            user=user,
            address_label='Home',
            address_text='456 Refund St',
            scheduled_date=timezone.localdate(),
            booking_type='regular',
            time_slot='morning',
            payment_method='razorpay',
            payment_status='paid',
            razorpay_order_id='order_refund_123',
            razorpay_payment_id='pay_refund_456',
            subtotal=1500,
            discount_amount=0,
            total_amount=1500,
        )

        mock_refund.return_value = {'id': 'rfnd_test_789', 'status': 'processed'}

        response = self.client.post(
            f'/api/v1/bookings/{booking.booking_number}/cancel/',
            HTTP_AUTHORIZATION=f'Token {token.key}',
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['ok'])
        self.assertEqual(data['refund_status'], 'initiated')

        booking.refresh_from_db()
        self.assertEqual(booking.status, 'cancelled')
        self.assertEqual(booking.payment_status, 'refunded')
        mock_refund.assert_called_once_with('pay_refund_456')
