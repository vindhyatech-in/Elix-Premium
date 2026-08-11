from allauth.account.adapter import DefaultAccountAdapter
from django.contrib.auth.models import Group, User
from django.urls import reverse

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

    def save_user(self, request, user, form, commit=True):
        """
        Every self-service signup — plain form or social (Google/Apple;
        allauth's DefaultSocialAccountAdapter.save_user() routes through
        this same account adapter's save_user()) — lands in the
        'customer' role group automatically. 'emp' is only ever assigned
        by an owner creating a login from the dashboard
        (core/admin_dashboard_views.py::_create_employee_login); 'owner'
        is never assigned by app code at all, only by hand via the
        Django admin's Group editor. See core/decorators.py and
        core/middleware.py for how these three groups gate access.
        """
        user = super().save_user(request, user, form, commit)
        if commit:
            customer_group, _ = Group.objects.get_or_create(name='customer')
            user.groups.add(customer_group)
        return user

    def get_login_redirect_url(self, request):
        """
        Sends an owner straight to their dashboard and an emp straight
        to theirs — never the marketing/booking app — instead of the
        default LOGIN_REDIRECT_URL ('/booking/'). Only applies when
        there's no explicit `?next=` (allauth itself gives that
        precedence over this method entirely); RoleRedirectMiddleware
        is the actual enforcement point for every subsequent request,
        this is just so a normal login doesn't need a second hop through
        it.
        """
        user = request.user
        if user.is_superuser:
            return super().get_login_redirect_url(request)
        if user.groups.filter(name='owner').exists():
            return reverse('admin_dashboard_overview')
        if user.groups.filter(name='emp').exists():
            return reverse('employee_dashboard')
        return super().get_login_redirect_url(request)

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
