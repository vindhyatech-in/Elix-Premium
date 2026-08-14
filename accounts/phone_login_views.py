import logging

from allauth.account.adapter import get_adapter
from allauth.core import ratelimit
from django.contrib import messages
from django.contrib.auth import REDIRECT_FIELD_NAME, login
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme

from accounts import messagecentral
from accounts.forms import PhoneLoginConfirmForm, PhoneLoginRequestForm

logger = logging.getLogger(__name__)

# A wrong-code lockout, same defense-in-depth reasoning as the employee
# arrival-OTP lockout (core/employee_dashboard_views.py) — MessageCentral
# is the source of truth for correctness/expiry now, but nothing stops
# an attacker from just hammering this endpoint with guesses otherwise.
MAX_CONFIRM_ATTEMPTS = 5


def _safe_next_url(request):
    next_url = request.POST.get(REDIRECT_FIELD_NAME) or request.GET.get(REDIRECT_FIELD_NAME)
    if next_url and url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}, require_https=request.is_secure()):
        return next_url
    return None


def request_phone_login(request):
    """
    Tier-2 login ("Continue with Phone Number") — replaces allauth's own
    login-by-code for this project, since MessageCentral's Verify Now
    product generates and validates its own OTP (there's no way to hand
    it an allauth-generated code to just relay, unlike MSG91's plain SMS
    API) — see accounts/messagecentral.py for the full explanation.
    """
    if request.user.is_authenticated:
        return redirect('index')

    if request.method == 'POST':
        form = PhoneLoginRequestForm(request.POST)
        if form.is_valid():
            phone = form.cleaned_data['phone']
            if not ratelimit.consume(request, action='phone_login_request', key=phone):
                form.add_error(None, 'Too many requests — please wait a bit and try again.')
            else:
                try:
                    verification_id = messagecentral.send_otp(phone)
                except (messagecentral.MessageCentralError, Exception):
                    logger.exception('MessageCentral send_otp failed for %s', phone)
                    form.add_error(None, "Couldn't send a code to that number right now — please try again shortly.")
                else:
                    request.session['phone_login'] = {
                        'phone': phone,
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
    # Without this, an already-authenticated session (a leftover tab, a
    # shared/kiosk device) that still had a pending phone_login in its
    # session could confirm a code meant to log in as a DIFFERENT
    # account, silently switching who's logged in — request_phone_login
    # already guards this the same way; this view just never had it.
    if request.user.is_authenticated:
        request.session.pop('phone_login', None)
        return redirect('index')

    state = request.session.get('phone_login')
    if not state:
        return redirect('phone_login_request')

    form = PhoneLoginConfirmForm(request.POST or None)

    if request.method == 'POST':
        if request.POST.get('action') == 'resend':
            if not ratelimit.consume(request, action='phone_login_resend', key=state['phone']):
                messages.error(request, 'Too many requests — please wait a bit and try again.')
            else:
                try:
                    state['verification_id'] = messagecentral.send_otp(state['phone'])
                    state['attempts'] = 0
                    state['sent_at'] = timezone.now().timestamp()
                    request.session['phone_login'] = state
                    messages.success(request, 'A new code has been sent.')
                except (messagecentral.MessageCentralError, Exception):
                    logger.exception('MessageCentral resend failed for %s', state['phone'])
                    messages.error(request, "Couldn't resend a code right now — please try again shortly.")
            return redirect('phone_login_confirm')

        if state.get('attempts', 0) >= MAX_CONFIRM_ATTEMPTS:
            messages.error(request, 'Too many incorrect attempts — request a new code.')
        elif form.is_valid():
            code = form.cleaned_data['code']
            try:
                verified = messagecentral.validate_otp(state['verification_id'], code)
            except Exception:
                logger.exception('MessageCentral validate_otp failed for %s', state['phone'])
                verified = False

            if verified:
                user = get_adapter().get_user_by_phone(state['phone'])
                if not user:
                    messages.error(request, "No account found with that number — sign up first.")
                    del request.session['phone_login']
                    return redirect('account_signup')

                # login() skips authenticate() entirely, so it never runs
                # ModelBackend's own is_active check — without this, a
                # deactivated account could still fully log in through
                # this tier even though the same account is correctly
                # blocked logging in with a password.
                if not user.is_active:
                    messages.error(request, 'This account has been disabled. Contact support for help.')
                    del request.session['phone_login']
                    return redirect('phone_login_request')

                get_adapter().set_phone_verified(user, state['phone'])
                login(request, user, backend='django.contrib.auth.backends.ModelBackend')
                next_url = state.get('next')
                del request.session['phone_login']
                return redirect(next_url or 'index')

            state['attempts'] = state.get('attempts', 0) + 1
            request.session['phone_login'] = state
            messages.error(request, 'Incorrect or expired code. Double-check and try again.')

    return render(request, 'account/phone_login_confirm.html', {
        'form': form,
        'phone': state['phone'],
        'attempts_left': max(0, MAX_CONFIRM_ATTEMPTS - state.get('attempts', 0)),
        'sent_at': state.get('sent_at', ''),
    })
