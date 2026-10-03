import json
from datetime import time, timedelta
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from django.utils import timezone
from accounts.models import Employee
from catalog.models import Category, Service, ServiceVariant
from bookings.models import Booking, BookingItem, UserNotification


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


class AutoAssignAndUrgentBadgeTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='customer1', email='cust1@example.com', password='pass')
        self.emp1 = Employee.objects.create(name='Pooja Sharma', phone='9876543211', slug='pooja-sharma', status='active')
        self.emp2 = Employee.objects.create(name='Neha Verma', phone='9876543212', slug='neha-verma', status='active')
        self.today = timezone.localdate()

    def test_buffer_blocking_rule(self):
        """
        Rule: A booking at 11am with 2 hrs duration (11am-1pm) blocks 10am-2pm (+/- 1 hr buffer).
        Another order at 1:30pm (or within 10am-2pm) must NOT be given to this beautician if another is free.
        """
        # Create 11am booking for emp1 lasting 2 hours (120 min)
        b1 = Booking.objects.create(
            user=self.user,
            assigned_beautician=self.emp1,
            scheduled_date=self.today,
            exact_time=time(11, 0),
            subtotal=500,
            total_amount=500,
            status='upcoming',
        )
        BookingItem.objects.create(
            booking=b1,
            name_snapshot='Bridal Facial',
            price_snapshot=500,
            duration_snapshot=120,
            quantity=1,
        )

        # New booking at 1:30 PM (13:30)
        b2 = Booking.objects.create(
            user=self.user,
            scheduled_date=self.today,
            exact_time=time(13, 30),
            subtotal=300,
            total_amount=300,
            status='upcoming',
        )
        BookingItem.objects.create(
            booking=b2,
            name_snapshot='Hair Spa',
            price_snapshot=300,
            duration_snapshot=60,
            quantity=1,
        )

        from bookings.auto_assign import auto_assign_beautician
        assigned = auto_assign_beautician(b2)
        # Emp1 is blocked 10am to 2pm. b2 is at 1:30pm (blocked window 12:30pm to 3:30pm), overlapping emp1's 10am-2pm!
        # Therefore, b2 must be assigned to emp2 (who is free), NOT emp1.
        self.assertEqual(assigned, self.emp2)

    def test_equal_load_distribution(self):
        """
        Rule: Try to provide equal orders for all beauticians in a day.
        If Emp1 already has 1 order and Emp2 has 0, the next non-overlapping order should go to Emp2.
        """
        # Emp1 has 1 order in the morning (8am - 9am)
        b1 = Booking.objects.create(
            user=self.user,
            assigned_beautician=self.emp1,
            scheduled_date=self.today,
            exact_time=time(8, 0),
            subtotal=200,
            total_amount=200,
            status='upcoming',
        )
        BookingItem.objects.create(
            booking=b1,
            name_snapshot='Express Manicure',
            price_snapshot=200,
            duration_snapshot=60,
            quantity=1,
        )

        # New booking in evening (5pm / 17:00), when both emp1 and emp2 are free
        b2 = Booking.objects.create(
            user=self.user,
            scheduled_date=self.today,
            exact_time=time(17, 0),
            subtotal=200,
            total_amount=200,
            status='upcoming',
        )
        BookingItem.objects.create(
            booking=b2,
            name_snapshot='Pedicure',
            price_snapshot=200,
            duration_snapshot=60,
            quantity=1,
        )

        from bookings.auto_assign import auto_assign_beautician
        assigned = auto_assign_beautician(b2)
        # Emp2 has 0 orders today, Emp1 has 1 order. Must balance to Emp2.
        self.assertEqual(assigned, self.emp2)

    def test_fallback_assigned_to_soonest_completed(self):
        """
        Rule: If no beautician is free in that time duration, don't leave unassigned;
        assign to the employee whose booking is going to be completed soonest.
        """
        # Both emp1 and emp2 are booked at 11am
        # emp1: 60 mins (ends at 12pm, block_end 1pm)
        # emp2: 120 mins (ends at 1pm, block_end 2pm)
        b1 = Booking.objects.create(
            user=self.user,
            assigned_beautician=self.emp1,
            scheduled_date=self.today,
            exact_time=time(11, 0),
            subtotal=200,
            total_amount=200,
            status='upcoming',
        )
        BookingItem.objects.create(
            booking=b1,
            name_snapshot='Quick Cleanup',
            price_snapshot=200,
            duration_snapshot=60,
            quantity=1,
        )

        b2 = Booking.objects.create(
            user=self.user,
            assigned_beautician=self.emp2,
            scheduled_date=self.today,
            exact_time=time(11, 0),
            subtotal=500,
            total_amount=500,
            status='upcoming',
        )
        BookingItem.objects.create(
            booking=b2,
            name_snapshot='Full Facial',
            price_snapshot=500,
            duration_snapshot=120,
            quantity=1,
        )

        # New booking at 11:30 AM (both emp1 and emp2 are blocked!)
        b3 = Booking.objects.create(
            user=self.user,
            scheduled_date=self.today,
            exact_time=time(11, 30),
            subtotal=200,
            total_amount=200,
            status='upcoming',
        )
        BookingItem.objects.create(
            booking=b3,
            name_snapshot='Threading',
            price_snapshot=200,
            duration_snapshot=30,
            quantity=1,
        )

        from bookings.auto_assign import auto_assign_beautician
        assigned = auto_assign_beautician(b3)
        # Nobody is free, but emp1 completes sooner than emp2 (block_end 1pm vs 2pm).
        # Must be assigned to emp1!
        self.assertIsNotNone(assigned)
        self.assertEqual(assigned, self.emp1)

    def test_urgent_badge_rendering(self):
        """
        Ensure urgent badge is rendered in employee job card and admin table.
        """
        from django.template import Context, Template
        urgent_booking = Booking.objects.create(
            user=self.user,
            assigned_beautician=self.emp1,
            scheduled_date=self.today,
            exact_time=time(14, 0),
            booking_type='urgent',
            subtotal=300,
            total_amount=300,
            status='upcoming',
        )

        # Test job_card.html template snippet with urgent booking
        job_card_tpl = Template("{% include 'employee_dashboard/job_card.html' with booking=booking %}")
        rendered = job_card_tpl.render(Context({'booking': urgent_booking}))
        self.assertIn('⚡ URGENT', rendered)
        self.assertIn('emp-job-card--urgent-highlight', rendered)

    def test_urgent_slot_availability_endpoint(self):
        """
        Ensure /booking/urgent-slots/ returns slots with live artist availability.
        """
        tomorrow = self.today + timedelta(days=1)
        res = self.client.get(f'/booking/urgent-slots/?date={tomorrow.strftime("%Y-%m-%d")}&duration=60')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get('ok'))
        self.assertTrue(data.get('has_slots'))
        self.assertTrue(len(data.get('slots', [])) > 0)
        # First slot on future date starts at 8:00 AM
        self.assertEqual(data['slots'][0]['time'], '08:00')

    def test_urgent_fallback_triggers_owner_alert(self):
        """
        When all beauticians are booked and an urgent booking is auto-assigned via fallback,
        ensure UserNotification is created for admins and fallback assigned to earliest free.
        """
        # Make a superuser/admin user
        User = get_user_model()
        admin_user = User.objects.create_superuser(username='adminboss', email='admin@elix.in', password='pass')

        # Book both emp1 and emp2
        b1 = Booking.objects.create(
            user=self.user,
            assigned_beautician=self.emp1,
            scheduled_date=self.today,
            exact_time=time(11, 0),
            subtotal=200,
            total_amount=200,
            status='upcoming',
        )
        BookingItem.objects.create(booking=b1, name_snapshot='Item 1', price_snapshot=200, duration_snapshot=60, quantity=1)

        b2 = Booking.objects.create(
            user=self.user,
            assigned_beautician=self.emp2,
            scheduled_date=self.today,
            exact_time=time(11, 0),
            subtotal=200,
            total_amount=200,
            status='upcoming',
        )
        BookingItem.objects.create(booking=b2, name_snapshot='Item 2', price_snapshot=200, duration_snapshot=120, quantity=1)

        # Urgent booking at 11:30 AM
        b3 = Booking.objects.create(
            user=self.user,
            scheduled_date=self.today,
            exact_time=time(11, 30),
            booking_type='urgent',
            subtotal=300,
            total_amount=300,
            status='upcoming',
        )
        BookingItem.objects.create(booking=b3, name_snapshot='Urgent Facial', price_snapshot=300, duration_snapshot=30, quantity=1)

        from bookings.auto_assign import auto_assign_beautician
        assigned = auto_assign_beautician(b3)
        self.assertEqual(assigned, self.emp1)

        # Verify admin in-app notification was created
        notif = UserNotification.objects.filter(user=admin_user, booking=b3).first()
        self.assertIsNotNone(notif)
        self.assertIn('URGENT OVERLAP', notif.title)

    def test_beautician_rush_bonus_awarded_for_30min_priority_buffer(self):
        """
        Rule: "charge 99 and pay 50rs to beautician if he/she need to start next booking in 30 min for priority order instead of one hour"
        When emp1 has a booking ending at 10:00 AM, standard 60-min buffer blocks until 11:00 AM.
        A priority urgent order at 10:30 AM (30 min gap) fits the 30-min buffer, assigning emp1 with a ₹50 rush bonus.
        """
        from decimal import Decimal
        # emp1 booking from 9:00 AM to 10:00 AM (60 min)
        b1 = Booking.objects.create(
            user=self.user,
            assigned_beautician=self.emp1,
            scheduled_date=self.today,
            exact_time=time(9, 0),
            subtotal=300,
            total_amount=300,
            status='upcoming',
        )
        BookingItem.objects.create(booking=b1, name_snapshot='Hair Cut', price_snapshot=300, duration_snapshot=60, quantity=1)

        # emp2 is on leave today
        from accounts.models import EmployeeLeave
        EmployeeLeave.objects.create(
            employee=self.emp2,
            leave_type='full_day',
            start_date=self.today,
            end_date=self.today,
        )

        # Priority urgent booking starting at 10:30 AM (gap is 30 min after 10:00 AM!)
        # With 60m buffer, emp1 is blocked (10:30 - 60m = 9:30 AM < 10:00 AM).
        # With 30m buffer, emp1 is free (10:30 - 30m = 10:00 AM >= 10:00 AM)!
        b_urgent = Booking.objects.create(
            user=self.user,
            scheduled_date=self.today,
            exact_time=time(10, 30),
            booking_type='urgent',
            subtotal=500,
            urgent_fee=Decimal('99.00'),
            total_amount=Decimal('599.00'),
            status='upcoming',
        )
        BookingItem.objects.create(booking=b_urgent, name_snapshot='Express Makeup', price_snapshot=500, duration_snapshot=30, quantity=1)

        from bookings.auto_assign import auto_assign_beautician
        assigned = auto_assign_beautician(b_urgent)
        self.assertEqual(assigned, self.emp1)
        # Because emp1 starts within 30 min buffer instead of 1 hour, she earns ₹50 rush bonus!
        self.assertEqual(b_urgent.beautician_rush_bonus, Decimal('50.00'))

    def test_standard_urgent_booking_without_rush_has_zero_bonus(self):
        """
        When beautician has plenty of time (e.g. 4 hours gap, well over 1 hour buffer),
        rush bonus is 0.
        """
        from decimal import Decimal
        # emp1 booking from 9:00 AM to 10:00 AM
        b1 = Booking.objects.create(
            user=self.user,
            assigned_beautician=self.emp1,
            scheduled_date=self.today,
            exact_time=time(9, 0),
            subtotal=300,
            total_amount=300,
            status='upcoming',
        )
        BookingItem.objects.create(booking=b1, name_snapshot='Hair Cut', price_snapshot=300, duration_snapshot=60, quantity=1)

        # Priority urgent booking at 3:00 PM (15:00) — 5 hours later!
        b_urgent = Booking.objects.create(
            user=self.user,
            scheduled_date=self.today,
            exact_time=time(15, 0),
            booking_type='urgent',
            subtotal=500,
            urgent_fee=Decimal('99.00'),
            total_amount=Decimal('599.00'),
            status='upcoming',
        )
        BookingItem.objects.create(booking=b_urgent, name_snapshot='Express Cleanup', price_snapshot=500, duration_snapshot=30, quantity=1)

        from bookings.auto_assign import auto_assign_beautician
        assigned = auto_assign_beautician(b_urgent)
        self.assertIsNotNone(assigned)
        # Standard buffer was fully available (5 hours gap) -> no rush bonus needed
        self.assertEqual(b_urgent.beautician_rush_bonus, Decimal('0.00'))



