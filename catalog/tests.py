from django.test import Client, TestCase
from catalog.models import Category, Service, ServiceAfterCare, ServiceVariant


class ServiceAfterCareTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name='Facial', slug='facial')
        self.service = Service.objects.create(
            category=self.category,
            name='Luxury Glow Facial',
            slug='luxury-glow-facial',
            is_active=True,
        )
        self.variant = ServiceVariant.objects.create(
            service=self.service,
            label='Standard',
            duration_mins=60,
            price=999,
            mrp=1499,
            is_default=True,
            is_active=True,
        )
        self.client = Client()

    def test_aftercare_creation_and_str(self):
        aftercare = ServiceAfterCare.objects.create(
            service=self.service,
            title='Facial After-Care Tips',
            tips='Tip 1\nTip 2',
        )
        self.assertEqual(str(aftercare), '[Luxury Glow Facial] Facial After-Care Tips')

    def test_tips_list_splitting_and_bullet_stripping(self):
        raw_text = """• Avoid using any face wash or soap for at least 24 hours.
- Do not apply makeup immediately to let your pores breathe.
* Stay away from direct sunlight and heavy sweat or steam for a day.
Keep yourself hydrated by drinking plenty of water.

"""
        aftercare = ServiceAfterCare.objects.create(
            service=self.service,
            tips=raw_text,
        )
        tips = aftercare.tips_list
        self.assertEqual(len(tips), 4)
        self.assertEqual(tips[0], 'Avoid using any face wash or soap for at least 24 hours.')
        self.assertEqual(tips[1], 'Do not apply makeup immediately to let your pores breathe.')
        self.assertEqual(tips[2], 'Stay away from direct sunlight and heavy sweat or steam for a day.')
        self.assertEqual(tips[3], 'Keep yourself hydrated by drinking plenty of water.')

    def test_formatted_tips_list_markdown_bold_and_html_escaping(self):
        raw_text = """Avoid using any **face wash or soap** for at least 24 hours.
Keep yourself **hydrated** & safe <script>alert(1)</script>."""
        aftercare = ServiceAfterCare.objects.create(
            service=self.service,
            tips=raw_text,
        )
        formatted = aftercare.formatted_tips_list
        self.assertIn('<strong>face wash or soap</strong>', formatted[0])
        self.assertIn('<strong>hydrated</strong>', formatted[1])
        # Verify script tag is safely escaped
        self.assertNotIn('<script>', formatted[1])
        self.assertIn('&lt;script&gt;', formatted[1])

    def test_service_detail_view_renders_aftercare_ul(self):
        ServiceAfterCare.objects.create(
            service=self.service,
            title='Facial After-Care Tips',
            tips='Avoid using any **face wash** for 24 hours.\nDrink plenty of water.',
        )
        response = self.client.get(f'/services/{self.service.slug}/')
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        self.assertIn('uc-aftercare', content)
        self.assertIn('Facial After-Care Tips', content)
        self.assertIn('<ul class="uc-aftercare__list">', content)
        self.assertIn('<strong>face wash</strong>', content)
        self.assertIn('Drink plenty of water.', content)

    def test_service_detail_view_without_aftercare(self):
        response = self.client.get(f'/services/{self.service.slug}/')
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        self.assertNotIn('<section class="uc-detail__section-card uc-aftercare"', content)
