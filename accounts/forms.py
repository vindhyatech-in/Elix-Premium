from allauth.account import app_settings
from allauth.account.adapter import get_adapter
from allauth.account.forms import ResetPasswordForm as AllauthResetPasswordForm
from allauth.account.forms import SignupForm as AllauthSignupForm
from allauth.account.utils import filter_users_by_email
from allauth.socialaccount.forms import SignupForm as AllauthSocialSignupForm
from django import forms
from django.contrib.auth.models import User

from accounts.fields import IndianPhoneField
from accounts.models import Profile


class ExtraSignupFieldsMixin(forms.Form):
    """
    first_name/last_name/age — the fields allauth's own signup forms don't
    add on their own (unlike email/phone/username, which BaseSignupForm
    already handles via ACCOUNT_SIGNUP_FIELDS). Shared between the plain
    and social-completion signup forms since both need the same fields.
    """
    first_name = forms.CharField(label='First name', max_length=150, required=True)
    last_name = forms.CharField(label='Last name', max_length=150, required=False)
    age = forms.IntegerField(required=True, min_value=13, max_value=120)

    def custom_signup(self, request, user):
        super().custom_signup(request, user)
        Profile.objects.update_or_create(user=user, defaults={'age': self.cleaned_data['age']})


class CustomSignupForm(ExtraSignupFieldsMixin, AllauthSignupForm):
    pass


class CustomSocialSignupForm(ExtraSignupFieldsMixin, AllauthSocialSignupForm):
    pass


class CustomResetPasswordForm(AllauthResetPasswordForm):
    """
    allauth's own ResetPasswordForm only accepts an email address. Adds a
    username option too — resolved to that user's email under the hood,
    since the underlying reset flow (allauth/account/internal/flows/
    password_reset.py) still needs an email address to send the link/code
    to either way.
    """
    email = forms.EmailField(required=False)
    username = forms.CharField(required=False, label='Username')

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if not email:
            return email
        email = email.lower()
        email = get_adapter().clean_email(email)
        self.users = filter_users_by_email(email, is_active=True, prefer_verified=True)
        if not self.users and not app_settings.PREVENT_ENUMERATION:
            raise get_adapter().validation_error('unknown_email')
        return email

    def clean(self):
        cleaned_data = super().clean()
        email = cleaned_data.get('email')
        username = cleaned_data.get('username')
        if not email and not username:
            raise forms.ValidationError('Enter your username or email address.')
        if not email and username:
            user = User.objects.filter(username__iexact=username, is_active=True).first()
            if user and user.email:
                self.users = [user]
                cleaned_data['email'] = user.email
            else:
                self.users = []
                if not app_settings.PREVENT_ENUMERATION:
                    raise get_adapter().validation_error('unknown_email')
        return cleaned_data


class PhoneLoginRequestForm(forms.Form):
    """
    Tier-2 login: Sign in with OTP sent to WhatsApp & Email.
    Accepts either a 10-digit Indian phone number (+91) or an email address.
    Supports both login_identifier and phone field names for compatibility.
    """
    login_identifier = forms.CharField(
        label='Phone number or Email',
        required=False,
        widget=forms.TextInput(attrs={
            'placeholder': 'Enter phone number or email',
            'autocomplete': 'username tel email',
            'autofocus': True,
        }),
    )
    phone = forms.CharField(required=False, widget=forms.HiddenInput())

    def clean(self):
        cleaned_data = super().clean()
        raw_val = (cleaned_data.get('login_identifier') or cleaned_data.get('phone') or '').strip()

        if not raw_val:
            raise forms.ValidationError('Please enter your phone number or email address.')

        if '@' in raw_val:
            email_field = forms.EmailField()
            try:
                cleaned_email = email_field.clean(raw_val).lower()
                cleaned_data['identifier_type'] = 'email'
                cleaned_data['email'] = cleaned_email
                cleaned_data['phone'] = ''
                return cleaned_data
            except forms.ValidationError:
                raise forms.ValidationError('Please enter a valid email address.')

        phone_field = IndianPhoneField()
        try:
            parsed_phone = phone_field.clean(raw_val)
        except forms.ValidationError:
            raise forms.ValidationError('Enter a valid 10-digit Indian phone number or email address.')

        cleaned_data['identifier_type'] = 'phone'
        cleaned_data['phone'] = parsed_phone
        cleaned_data['email'] = ''
        return cleaned_data



class PhoneLoginConfirmForm(forms.Form):
    code = forms.CharField(
        label='Code',
        max_length=6,
        widget=forms.TextInput(attrs={'placeholder': '6-digit code', 'inputmode': 'numeric', 'autocomplete': 'one-time-code'}),
    )
