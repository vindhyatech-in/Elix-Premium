import json
from django.conf import settings
from django.core.management.base import BaseCommand

from accounts import whatsapp_otp


class Command(BaseCommand):
    help = 'Test sending a WhatsApp OTP authentication template via Meta Cloud API'

    def add_arguments(self, parser):
        parser.add_argument('phone', type=str, help='Recipient phone number (e.g. 9876543210 or +919876543210)')
        parser.add_argument(
            '--code',
            type=str,
            default=None,
            help='Optional 6-digit OTP code to send (default: randomly generated)',
        )

    def handle(self, *args, **options):
        phone = options['phone']
        custom_code = options['code']

        clean_num = whatsapp_otp.clean_phone_number(phone)
        token = getattr(settings, 'WHATSAPP_ACCESS_TOKEN', '').strip()
        phone_id = getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', '').strip()
        template_name = getattr(settings, 'WHATSAPP_TEMPLATE_NAME', 'login_otp')
        template_lang = getattr(settings, 'WHATSAPP_TEMPLATE_LANG', 'en_US')
        api_version = getattr(settings, 'WHATSAPP_API_VERSION', 'v20.0')

        self.stdout.write(self.style.NOTICE('=== WhatsApp OTP Meta Cloud API Test ==='))
        self.stdout.write(f'Recipient: {clean_num}')
        self.stdout.write(f'Phone Number ID: {phone_id}')
        self.stdout.write(f'Template Name: {template_name}')
        self.stdout.write(f'Template Language: {template_lang}')
        self.stdout.write(f'API Version: {api_version}')

        if token:
            masked = f'{token[:8]}...{token[-4:]}'
            self.stdout.write(f'Access Token: {masked}')
        else:
            self.stdout.write(self.style.WARNING('Access Token: [EMPTY] (Add WHATSAPP_ACCESS_TOKEN to .env)'))

        if not token:
            self.stdout.write(self.style.ERROR(
                '\n[ERROR] WHATSAPP_ACCESS_TOKEN is not set in .env. '
                'Please set it and run this command again.'
            ))
            return

        code = custom_code or '123456'
        self.stdout.write(f'Sending OTP Code: {code}')

        try:
            resp = whatsapp_otp._dispatch_meta_message(clean_num, code)
            self.stdout.write(self.style.SUCCESS('\n[SUCCESS] Meta WhatsApp API responded successfully!'))
            self.stdout.write(json.dumps(resp, indent=2))
            self.stdout.write(self.style.SUCCESS(f'\nCheck WhatsApp on {clean_num} for the message!'))
        except whatsapp_otp.WhatsAppAPIError as exc:
            self.stdout.write(self.style.ERROR(f'\n[FAILED] Meta API returned an error:\n{exc}'))
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f'\n[FAILED] Unexpected exception:\n{exc}'))
