from django.contrib.auth.models import Group, User
from django.test import Client, TestCase
from django.urls import reverse


class ImpersonationTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.superadmin = User.objects.create_superuser(
            username='admin_boss',
            email='admin@example.com',
            password='Password123!',
        )
        self.other_superadmin = User.objects.create_superuser(
            username='admin_second',
            email='admin2@example.com',
            password='Password123!',
        )
        self.customer = User.objects.create_user(
            username='customer_jane',
            email='jane@example.com',
            password='Password123!',
        )
        self.owner = User.objects.create_user(
            username='owner_bob',
            email='bob@example.com',
            password='Password123!',
        )
        owner_group, _ = Group.objects.get_or_create(name='owner')
        self.owner.groups.add(owner_group)

    def test_non_superuser_cannot_impersonate(self):
        self.client.force_login(self.customer)
        url = reverse('admin_impersonate_user', args=[self.owner.id])
        response = self.client.get(url, follow=True)
        # Blocked and redirected
        self.assertEqual(int(self.client.session.get('_auth_user_id')), self.customer.id)
        self.assertNotIn('impersonator_id', self.client.session)

    def test_superadmin_can_impersonate_customer(self):
        self.client.force_login(self.superadmin)
        url = reverse('admin_impersonate_user', args=[self.customer.id])
        response = self.client.get(url, follow=True)

        # Authenticated user is now the customer
        self.assertEqual(int(self.client.session.get('_auth_user_id')), self.customer.id)
        # Impersonator markers are stamped
        self.assertEqual(self.client.session.get('impersonator_id'), self.superadmin.id)
        self.assertEqual(self.client.session.get('impersonator_username'), 'admin_boss')

    def test_superadmin_cannot_impersonate_another_superadmin(self):
        self.client.force_login(self.superadmin)
        url = reverse('admin_impersonate_user', args=[self.other_superadmin.id])
        response = self.client.get(url, follow=True)

        # Still logged in as original superadmin
        self.assertEqual(int(self.client.session.get('_auth_user_id')), self.superadmin.id)
        self.assertNotIn('impersonator_id', self.client.session)

    def test_stop_impersonation_restores_superadmin(self):
        # Initiate impersonation
        self.client.force_login(self.superadmin)
        impersonate_url = reverse('admin_impersonate_user', args=[self.customer.id])
        self.client.get(impersonate_url, follow=True)
        self.assertEqual(int(self.client.session.get('_auth_user_id')), self.customer.id)

        # Stop impersonation
        stop_url = reverse('admin_stop_impersonation')
        response = self.client.get(stop_url, follow=True)

        # Restored to original superadmin
        self.assertEqual(int(self.client.session.get('_auth_user_id')), self.superadmin.id)
        self.assertNotIn('impersonator_id', self.client.session)
        self.assertNotIn('impersonator_username', self.client.session)

    def test_impersonation_banner_injected_in_html(self):
        self.client.force_login(self.superadmin)
        impersonate_url = reverse('admin_impersonate_user', args=[self.owner.id])
        self.client.get(impersonate_url, follow=True)

        # Access dashboard
        response = self.client.get(reverse('admin_dashboard_overview'))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8')

        # Check banner presence and content
        self.assertIn('superadmin-impersonation-bar', content)
        self.assertIn('Switch Back to Admin', content)
        self.assertIn('admin_boss', content)


class DualWhatsAppAndEmailOTPTests(TestCase):
    def setUp(self):
        from accounts.models import Profile
        self.client = Client()
        self.user = User.objects.create_user(
            username='sachin_test',
            email='sachin@example.com',
            password='Password123!',
        )
        Profile.objects.update_or_create(
            user=self.user,
            defaults={'phone': '+919584979324'}
        )

    def test_send_otp_stores_both_phone_and_email(self):
        from accounts import whatsapp_otp
        from django.core.cache import cache

        v_id = whatsapp_otp.send_otp(phone='9584979324', email='sachin@example.com')
        cached = cache.get(f'{whatsapp_otp.CACHE_PREFIX}{v_id}')
        self.assertIsNotNone(cached)
        self.assertEqual(cached['phone'], '919584979324')
        self.assertEqual(cached['email'], 'sachin@example.com')
        self.assertEqual(len(cached['code']), 6)

    def test_phone_login_request_with_phone_resolves_email(self):
        url = reverse('phone_login_request')
        response = self.client.post(url, {'login_identifier': '9584979324'}, follow=True)
        self.assertEqual(response.status_code, 200)
        session_data = self.client.session.get('phone_login')
        self.assertIsNotNone(session_data)
        self.assertEqual(session_data['phone'], '+919584979324')
        self.assertEqual(session_data['email'], 'sachin@example.com')

    def test_phone_login_request_with_email_resolves_phone(self):
        url = reverse('phone_login_request')
        response = self.client.post(url, {'login_identifier': 'sachin@example.com'}, follow=True)
        self.assertEqual(response.status_code, 200)
        session_data = self.client.session.get('phone_login')
        self.assertIsNotNone(session_data)
        self.assertEqual(session_data['phone'], '+919584979324')
        self.assertEqual(session_data['email'], 'sachin@example.com')

    def test_confirm_otp_successful_login(self):
        from accounts import whatsapp_otp
        from django.core.cache import cache

        # Request OTP
        self.client.post(reverse('phone_login_request'), {'login_identifier': '9584979324'})
        session_data = self.client.session['phone_login']
        cached = cache.get(f"{whatsapp_otp.CACHE_PREFIX}{session_data['verification_id']}")
        code = cached['code']

        # Confirm OTP
        confirm_url = reverse('phone_login_confirm')
        res = self.client.post(confirm_url, {'code': code}, follow=True)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(int(self.client.session.get('_auth_user_id')), self.user.id)

