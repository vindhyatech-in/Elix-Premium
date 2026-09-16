import json
from datetime import timedelta
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from django.utils import timezone
from catalog.models import Category, Service, ServiceVariant
from bookings.models import Booking, UserNotification


class TimezoneConfigurationTests(TestCase):
    def test_use_tz_and_timezone_settings(self):
        """Ensure USE_TZ is True and TIME_ZONE is Asia/Kolkata."""
        self.assertTrue(settings.USE_TZ)
        self.assertEqual(settings.TIME_ZONE, 'Asia/Kolkata')

    def test_timezone_now_is_aware(self):
        """Ensure timezone.now() returns timezone-aware datetimes."""
        now = timezone.now()
        self.assertTrue(timezone.is_aware(now))

    def test_timezone_localtime_and_localdate(self):
        """Ensure localdate and localtime respect the Asia/Kolkata timezone."""
        local_dt = timezone.localtime()
        local_date = timezone.localdate()
        self.assertTrue(timezone.is_aware(local_dt))
        self.assertEqual(local_dt.tzinfo.key if hasattr(local_dt.tzinfo, 'key') else str(local_dt.tzinfo), 'Asia/Kolkata')
        self.assertEqual(local_dt.date(), local_date)

    def test_booking_datetime_timestamps_are_aware(self):
        """Ensure models created with DateTimeField auto_now_add produce timezone-aware fields."""
        User = get_user_model()
        user = User.objects.create_user(username='testtzuser', email='tz@example.com', password='password123')
        booking = Booking.objects.create(
            user=user,
            scheduled_date=timezone.localdate(),
            time_slot='morning',
            subtotal=100,
            total_amount=100,
        )
        self.assertTrue(timezone.is_aware(booking.created_at))
        self.assertTrue(timezone.is_aware(booking.updated_at))

        notif = UserNotification.objects.create(
            user=user,
            booking=booking,
            ntype='general',
            title='Test Notice',
            body='This is a test notification',
        )
        self.assertTrue(timezone.is_aware(notif.created_at))
        # time_label computes delta between tz.now() and notif.created_at
        self.assertEqual(notif.time_label, 'Just now')


class BookingSlotValidationTimezoneTests(TestCase):
    def setUp(self):
        self.client = Client()
        User = get_user_model()
        self.user = User.objects.create_user(username='booker', email='booker@example.com', password='password123')
        self.client.force_login(self.user)

        self.category = Category.objects.create(name='Facial Care', slug='facial-care')
        self.service = Service.objects.create(category=self.category, name='Gold Facial', slug='gold-facial')
        self.variant = ServiceVariant.objects.create(
            service=self.service,
            label='Standard',
            price=999,
            mrp=1299,
            duration_mins=60,
        )

    def test_past_date_booking_rejected(self):
        """Booking for yesterday must be rejected with 400."""
        yesterday = timezone.localdate() - timedelta(days=1)
        payload = {
            'date': yesterday.strftime('%Y-%m-%d'),
            'booking_type': 'regular',
            'time_slot': 'morning',
            'payment_method': 'pay-at-home',
            'cart': [{'kind': 'service', 'variant_id': self.variant.id, 'quantity': 1}],
            'address': {
                'text': '123 Main St, Varanasi, UP 221001',
                'lat': 25.3176,
                'lng': 82.9739,
            },
        }
        res = self.client.post(
            '/booking/checkout/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 400)
        data = res.json()
        self.assertFalse(data.get('ok'))
        self.assertEqual(data.get('error'), 'Scheduled date cannot be in the past.')

    def test_urgent_booking_50min_advance_enforced(self):
        """Urgent booking for today earlier than 50 minutes in advance must be rejected."""
        today = timezone.localdate()
        local_now = timezone.localtime()
        # 10 minutes from now (less than 50 min)
        too_soon = (local_now + timedelta(minutes=10)).time()

        payload = {
            'date': today.strftime('%Y-%m-%d'),
            'booking_type': 'urgent',
            'exact_time': too_soon.strftime('%H:%M'),
            'payment_method': 'pay-at-home',
            'cart': [{'kind': 'service', 'variant_id': self.variant.id, 'quantity': 1}],
            'address': {
                'text': '123 Main St, Varanasi, UP 221001',
                'lat': 25.3176,
                'lng': 82.9739,
            },
        }
        res = self.client.post(
            '/booking/checkout/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 400)
        data = res.json()
        self.assertFalse(data.get('ok'))
        self.assertIn('50 minutes in advance', data.get('error', ''))


class ServiceDetailPageTests(TestCase):
    def setUp(self):
        self.category, _ = Category.objects.get_or_create(slug='test-threading', defaults={'name': 'Test Threading'})
        self.service, _ = Service.objects.get_or_create(
            slug='test-eyebrows',
            defaults={
                'name': 'Test Eyebrows',
                'category': self.category,
                'description': 'Professional eyebrow threading.',
                'rating': 4.9,
                'reviews_count': 120,
                'is_active': True,
            }
        )
        self.variant, _ = ServiceVariant.objects.get_or_create(
            service=self.service,
            defaults={
                'label': 'Standard',
                'price': 39,
                'duration_mins': 10,
                'is_active': True,
                'is_default': True,
            }
        )

    def test_service_detail_page_renders_uc_elements(self):
        """Ensure service detail page renders 200 and includes Urban Company detail layout."""
        res = self.client.get(f'/services/{self.service.slug}/')
        self.assertEqual(res.status_code, 200)
        content = res.content.decode('utf-8')
        self.assertIn('uc-detail', content)
        self.assertIn('uc-detail__sticky-bar', content)
        self.assertIn('Back to Services', content)
        self.assertIn('catalog-data', content)
        self.assertIn('Test Eyebrows', content)
        self.assertIn('39', content)

