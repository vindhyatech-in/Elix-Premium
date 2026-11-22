from django.test import TestCase, Client
from django.contrib.auth.models import User
from api.models import AuthToken
from accounts.models import Employee
from bookings.models import Booking
import json
import datetime

class AuthChangePasswordAndBookingTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='OldPassword123!',
            first_name='Test',
            last_name='User',
        )
        self.token = AuthToken.objects.create(user=self.user)
        self.auth_headers = {'HTTP_AUTHORIZATION': f'Token {self.token.key}'}

    def test_change_password_unauthenticated(self):
        resp = self.client.post('/api/v1/auth/change-password/', json.dumps({
            'current_password': 'OldPassword123!',
            'new_password': 'NewPassword456!',
        }), content_type='application/json')
        self.assertEqual(resp.status_code, 401)

    def test_change_password_wrong_current(self):
        resp = self.client.post('/api/v1/auth/change-password/', json.dumps({
            'current_password': 'WrongPassword!',
            'new_password': 'NewPassword456!',
        }), content_type='application/json', **self.auth_headers)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Current password does not match', resp.json().get('error', ''))

    def test_change_password_too_short(self):
        resp = self.client.post('/api/v1/auth/change-password/', json.dumps({
            'current_password': 'OldPassword123!',
            'new_password': '123',
        }), content_type='application/json', **self.auth_headers)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('at least 6 characters', resp.json().get('error', ''))

    def test_change_password_same_password(self):
        resp = self.client.post('/api/v1/auth/change-password/', json.dumps({
            'current_password': 'OldPassword123!',
            'new_password': 'OldPassword123!',
        }), content_type='application/json', **self.auth_headers)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('cannot be the same', resp.json().get('error', ''))

    def test_change_password_success(self):
        resp = self.client.post('/api/v1/auth/change-password/', json.dumps({
            'current_password': 'OldPassword123!',
            'new_password': 'BrandNewPassword999!',
        }), content_type='application/json', **self.auth_headers)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json().get('ok'))

        # Verify new password works
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('BrandNewPassword999!'))
        self.assertFalse(self.user.check_password('OldPassword123!'))

    def test_booking_serialization_with_assigned_beautician(self):
        emp_user = User.objects.create_user(username='emp_sachin', first_name='Sachin', last_name='Shah')
        emp = Employee.objects.create(name='Sachin Shah', phone='9876543210', status='active')
        booking = Booking.objects.create(
            user=self.user,
            scheduled_date=datetime.date.today(),
            status='upcoming',
            assigned_beautician=emp,
            address_label='Home',
            address_text='Vijay Nagar, Indore',
            subtotal=500.0,
            total_amount=500.0,
        )

        resp = self.client.get('/api/v1/bookings/', **self.auth_headers)
        self.assertEqual(resp.status_code, 200)
        bookings = resp.json().get('bookings', [])
        self.assertEqual(len(bookings), 1)
        b_data = bookings[0]
        self.assertEqual(b_data['status'], 'assigned')
        self.assertEqual(b_data['status_display'], 'Beautician Assigned')
        self.assertIsNotNone(b_data['assigned_beautician'])
        self.assertEqual(b_data['assigned_beautician']['name'], 'Sachin Shah')
        self.assertEqual(b_data['assigned_beautician']['phone'], '9876543210')

    def test_mobile_checkout_auto_assigns_beautician(self):
        from catalog.models import Category, Service, ServiceVariant
        cat = Category.objects.create(name='Waxing', slug='waxing')
        srv = Service.objects.create(category=cat, name='Full Wax', slug='full-wax', is_active=True)
        variant = ServiceVariant.objects.create(service=srv, label='Standard', price=299.00, duration_mins=45, is_active=True)
        emp = Employee.objects.create(name='Expert Beautician 1', phone='9111222333', status='active')

        tomorrow = datetime.date.today() + datetime.timedelta(days=1)
        payload = {
            'address': {'label': 'Home', 'text': '123 MG Road, Indore', 'pincode': '452001'},
            'booking_type': 'regular',
            'time_slot': 'morning',
            'scheduled_date': tomorrow.isoformat(),
            'payment_method': 'pay_at_home',
            'cart': [{
                'id': srv.slug,
                'variantId': variant.id,
                'is_package': False,
                'qty': 1,
            }]
        }
        resp = self.client.post('/api/v1/bookings/checkout/', json.dumps(payload), content_type='application/json', **self.auth_headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get('ok'))
        booking_num = data.get('booking_number')

        booking = Booking.objects.get(booking_number=booking_num)
        self.assertIsNotNone(booking.assigned_beautician)
        self.assertEqual(booking.assigned_beautician.id, emp.id)

