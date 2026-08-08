from allauth.account.adapter import DefaultAccountAdapter
from django.contrib.auth.models import User

from accounts.models import Profile
from accounts.utils import generate_username_from_name


class AccountAdapter(DefaultAccountAdapter):
    """
    Wires allauth's phone-field signup handling (see developed.md
    "Authentication") to this project's Profile model, and replaces
    allauth's own random-suffix username generation with the same
    firstname+lastname scheme employee logins use (accounts/utils.py).

    Tier-2 login ("Continue with Phone Number") does NOT go through
    allauth's own login-by-code/send_verification_code_sms hook anymore —
    see accounts/phone_login_views.py + accounts/messagecentral.py for
    why (MessageCentral's Verify Now product generates and validates its
    own OTP, so there's nothing for this adapter to "send"). get_phone/
    set_phone/get_user_by_phone below stay in use for the signup form's
    mandatory phone field and the phone-login views' user lookup.
    """

    def populate_username(self, request, user):
        user.username = generate_username_from_name(user.first_name, user.last_name)

    def get_login_stages(self):
        """
        Drops PhoneVerificationStage from the pipeline entirely. It runs
        on every login regardless of ACCOUNT_PHONE_VERIFICATION_ENABLED
        (that flag is only checked once a phone already exists on the
        account) — for any account with NO phone on file at all
        (a superuser from createsuperuser, an employee login from
        core/admin_dashboard_views.py, neither of which ever sets
        Profile.phone), it hits the "abort without a response" branch
        in allauth/account/stages.py::LoginStageController.handle(),
        which just dumps the user back to the login page with a logged
        error and no explanation. Phone verification only ever happens
        through the optional MessageCentral-backed tier in
        accounts/phone_login_views.py, never as a forced login stage.
        """
        return [s for s in super().get_login_stages() if 'PhoneVerificationStage' not in s]

    def phone_form_field(self, **kwargs):
        from accounts.fields import IndianPhoneField
        return IndianPhoneField(**kwargs)

    def set_phone(self, user, phone, verified):
        Profile.objects.update_or_create(user=user, defaults={'phone': phone, 'phone_verified': verified})

    def get_phone(self, user):
        profile = getattr(user, 'profile', None)
        if not profile or not profile.phone:
            return None
        return (profile.phone, profile.phone_verified)

    def set_phone_verified(self, user, phone):
        Profile.objects.filter(user=user).update(phone_verified=True)

    def get_user_by_phone(self, phone):
        return User.objects.filter(profile__phone=phone).first()
