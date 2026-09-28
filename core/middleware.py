from django.shortcuts import redirect

# Path prefixes an owner/emp account can still reach — everything else
# (marketing homepage, booking app, service detail, profile, etc.) gets
# redirected to their own dashboard. Kept as prefixes, not exact paths,
# so nothing under e.g. /dashboard/services/ needs listing individually.
ALWAYS_ALLOWED_PREFIXES = (
    '/dashboard/', '/employee/', '/accounts/', '/admin/',
    '/static/', '/media/', '/api/',
)


class RoleRedirectMiddleware:
    """
    Keeps the owner and employee roles out of the customer-facing
    marketing/booking app entirely — "when owner login marketing page
    should disappear, redirect to dashboard, emp to emp dashboard" (see
    accounts/adapter.py::get_login_redirect_url for the same behavior
    applied once, right after login; this is the enforcement point for
    every request after that — a bookmarked URL, an explicit `?next=`,
    browser back/forward, all land here too). Superusers are exempt —
    "super admin will have access of all things", including being able
    to browse the customer app if they want to.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if user and user.is_authenticated and not user.is_superuser:
            if not request.path.startswith(ALWAYS_ALLOWED_PREFIXES):
                if user.groups.filter(name='owner').exists():
                    return redirect('admin_dashboard_overview')
                if user.groups.filter(name='emp').exists():
                    return redirect('employee_dashboard')
        return self.get_response(request)


class ImpersonationBannerMiddleware:
    """
    Renders a persistent floating top banner whenever an active session
    is impersonating another user (request.session['impersonator_id']).
    Allows the superadmin to easily see who they are acting as and
    provides a one-click 'Switch Back to Admin' action.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        impersonator_id = request.session.get('impersonator_id') if hasattr(request, 'session') else None
        if not impersonator_id or not getattr(request, 'user', None) or not request.user.is_authenticated:
            return response

        # Only inject into HTML responses that contain </body>
        content_type = response.get('Content-Type', '').lower()
        if 'text/html' not in content_type:
            return response

        if not hasattr(response, 'content'):
            return response

        body_tag = b'</body>'
        if body_tag not in response.content:
            return response

        # Derive role label for the impersonated user
        user = request.user
        if user.is_superuser:
            role_label = 'Super Admin'
        else:
            groups = set(user.groups.values_list('name', flat=True))
            if 'owner' in groups:
                role_label = 'Owner'
            elif 'emp' in groups:
                role_label = 'Employee'
            else:
                role_label = 'Customer'

        admin_username = request.session.get('impersonator_username', 'Superadmin')
        target_display = user.get_full_name() or user.username
        if user.email and user.email != target_display:
            target_display += f" ({user.email})"

        banner_html = f"""
<!-- Superadmin Impersonation Banner -->
<div id="superadmin-impersonation-bar" style="position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647; background: linear-gradient(90deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%); color: #ffffff; padding: 7px 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 500; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border-bottom: 2px solid #818cf8; line-height: 1.4;">
  <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
    <span style="background: #f59e0b; color: #78350f; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 2px 8px; border-radius: 9999px; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 4px;">
      <svg width="10" height="10" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
      Impersonating
    </span>
    <span>Logged in as <strong>{target_display}</strong> <span style="background: rgba(255,255,255,0.15); padding: 1px 6px; border-radius: 4px; font-size: 11px;">{role_label}</span></span>
    <span style="opacity: 0.75; font-size: 12px;">(Initiated by Super Admin: <strong>{admin_username}</strong>)</span>
  </div>
  <a href="/accounts/impersonate/stop/" style="background: #ffffff; color: #312e81; padding: 4px 14px; border-radius: 6px; font-weight: 700; text-decoration: none; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: all 0.15s ease;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='#ffffff'">
    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>
    Switch Back to Admin
  </a>
</div>
<style>
  body {{ padding-top: 36px !important; }}
</style>
"""
        response.content = response.content.replace(body_tag, banner_html.encode('utf-8') + body_tag)
        if response.has_header('Content-Length'):
            response['Content-Length'] = str(len(response.content))

        return response
