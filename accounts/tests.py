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
