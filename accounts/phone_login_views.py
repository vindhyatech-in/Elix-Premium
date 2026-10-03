import logging

from allauth.account.adapter import get_adapter
from allauth.core import ratelimit
from django.contrib import messages
from django.contrib.auth import REDIRECT_FIELD_NAME, login
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme

from accounts import whatsapp_otp
from accounts.forms import PhoneLoginConfirmForm, PhoneLoginRequestForm

from django.contrib.auth.models import User

logger = logging.getLogger(__name__)

# A wrong-code lockout, same defense-in-depth reasoning as the employee
# arrival-OTP lockout (core/employee_dashboard_views.py) — 5 failed attempts
# invalidates the current challenge, forcing a fresh code request.
MAX_CONFIRM_ATTEMPTS = 5


def _mask_phone(phone):
    if not phone:
        return ''
    digits = ''.join(c for c in phone if c.isdigit())
    if len(digits) >= 10:
        return f'+91 ••••• •{digits[-4:]}'
    return phone


def _mask_email(email):
    if not email or '@' not in email:
        return email or ''
    name, domain = email.split('@', 1)
    if len(name) <= 2:
        masked_name = name[0] + '*'
    else:
        masked_name = name[0] + '*' * (len(name) - 2) + name[-1]
    return f'{masked_name}@{domain}'


def _safe_next_url(request):
    next_url = request.POST.get(REDIRECT_FIELD_NAME) or request.GET.get(REDIRECT_FIELD_NAME)
    if next_url and url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}, require_https=request.is_secure()):
        return next_url
    return None


def request_phone_login(request):
    """
    Tier-2 login ("Sign In with OTP") — sends a 6-digit one-time verification
    code via WhatsApp (Meta Cloud API) as well as Email (to registered email).
    """
    if request.user.is_authenticated:
        return redirect('index')

    if request.method == 'POST':
        form = PhoneLoginRequestForm(request.POST)
        if form.is_valid():
            phone = form.cleaned_data.get('phone') or ''
            email = form.cleaned_data.get('email') or ''
            ident_type = form.cleaned_data.get('identifier_type', 'phone')

            # Lookup user to resolve both phone and email channels
            if ident_type == 'email' and email:
                user = User.objects.filter(email__iexact=email, is_active=True).first()
                if user and hasattr(user, 'profile') and user.profile.phone:
                    phone = user.profile.phone
            elif phone:
                user = get_adapter().get_user_by_phone(phone)
                if user and user.email:
                    email = user.email

            rl_key = phone or email
            if not ratelimit.consume(request, action='phone_login_request', key=rl_key):
                form.add_error(None, 'Too many requests — please wait a bit and try again.')
            else:
                try:
                    verification_id = whatsapp_otp.send_otp(phone=phone, email=email)
                except Exception:
                    logger.exception('send_otp failed for phone=%s email=%s', phone, email)
                    form.add_error(None, "Couldn't send a verification code right now — please try again shortly.")
                else:
                    request.session['phone_login'] = {
                        'phone': phone,
                        'email': email,
                        'verification_id': verification_id,
                        'attempts': 0,
                        'sent_at': timezone.now().timestamp(),
                    }
                    next_url = _safe_next_url(request)
                    if next_url:
                        request.session['phone_login']['next'] = next_url
                    return redirect('phone_login_confirm')
    else:
        form = PhoneLoginRequestForm()

    return render(request, 'account/phone_login_request.html', {'form': form})


def confirm_phone_login(request):
    if request.user.is_authenticated:
        request.session.pop('phone_login', None)
        return redirect('index')

    state = request.session.get('phone_login')
    if not state:
        return redirect('phone_login_request')

    form = PhoneLoginConfirmForm(request.POST or None)

    if request.method == 'POST':
        if request.POST.get('action') == 'resend':
            rl_key = state.get('phone') or state.get('email')
            if not ratelimit.consume(request, action='phone_login_resend', key=rl_key):
                messages.error(request, 'Too many requests — please wait a bit and try again.')
            else:
                try:
                    state['verification_id'] = whatsapp_otp.send_otp(
                        phone=state.get('phone'),
                        email=state.get('email')
                    )
                    state['attempts'] = 0
                    state['sent_at'] = timezone.now().timestamp()
                    request.session['phone_login'] = state
                    if state.get('phone') and state.get('email'):
                        messages.success(request, 'A new verification code has been sent to your WhatsApp and Email.')
                    elif state.get('email'):
                        messages.success(request, 'A new verification code has been sent to your Email.')
                    else:
                        messages.success(request, 'A new verification code has been sent to your WhatsApp.')
                except Exception:
                    logger.exception('Resend failed for %s', rl_key)
                    messages.error(request, "Couldn't resend code right now — please try again shortly.")
            return redirect('phone_login_confirm')

        if state.get('attempts', 0) >= MAX_CONFIRM_ATTEMPTS:
            messages.error(request, 'Too many incorrect attempts — request a new code.')
        elif form.is_valid():
            code = form.cleaned_data['code']
            try:
                verified = whatsapp_otp.validate_otp(state['verification_id'], code)
            except Exception:
                logger.exception('validate_otp failed for %s', state.get('phone') or state.get('email'))
                verified = False

            if verified:
                phone = state.get('phone')
                email = state.get('email')
                user = None
                if phone:
                    user = get_adapter().get_user_by_phone(phone)
                if not user and email:
                    user = User.objects.filter(email__iexact=email).first()

                if not user:
                    messages.error(request, "No account found — sign up first.")
                    del request.session['phone_login']
                    return redirect('account_signup')

                # login() skips authenticate() entirely, so it never runs
                # ModelBackend's own is_active check — guard deactivated accounts.
                if not user.is_active:
                    messages.error(request, 'This account has been disabled. Contact support for help.')
                    del request.session['phone_login']
                    return redirect('phone_login_request')

                if phone:
                    get_adapter().set_phone_verified(user, phone)
                login(request, user, backend='django.contrib.auth.backends.ModelBackend')
                next_url = state.get('next')
                del request.session['phone_login']
                return redirect(next_url or 'index')

            state['attempts'] = state.get('attempts', 0) + 1
            request.session['phone_login'] = state
            messages.error(request, 'Incorrect or expired code. Double-check and try again.')

    phone = state.get('phone', '')
    email = state.get('email', '')
    return render(request, 'account/phone_login_confirm.html', {
        'form': form,
        'phone': phone,
        'email': email,
        'masked_phone': _mask_phone(phone),
        'masked_email': _mask_email(email),
        'has_both': bool(phone and email),
        'attempts_left': max(0, MAX_CONFIRM_ATTEMPTS - state.get('attempts', 0)),
        'sent_at': state.get('sent_at', ''),
    })


