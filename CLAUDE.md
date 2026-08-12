# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first: `developed.md`

This repo maintains a living architecture document, **`developed.md`**, written explicitly for an
agent (or new dev) to get full context in one pass. Its **"Current state"** section at the top is
kept accurate and supersedes everything below it in that same file (the rest is a dated,
never-rewritten changelog — useful for *why*, not for *current schema*). **Read `developed.md`
before making non-trivial changes, and update its "Current state" section whenever models, roles,
or major URLs change** — same discipline as keeping a README current. `AUDIT_FINDINGS.md` is a
dated security/bug audit; check whether an item is still open before trusting it (several are
marked fixed inline, and it predates later changes described in `developed.md`).

## Commands

```bash
# Setup
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate

# Run (SQLite by default; switches to Postgres automatically if .env sets DB_HOST)
python manage.py runserver

# Django shell / management commands
python manage.py shell
python manage.py createsuperuser
python manage.py makemigrations <app>   # after editing models.py in core/accounts/catalog/bookings
python manage.py collectstatic --noinput

# Tests (per-app test.py/tests.py files exist but are currently empty stubs)
python manage.py test
python manage.py test accounts   # single app
```

`deploy.sh` is the production deploy script (git pull → migrate → collectstatic → restart
gunicorn/nginx via systemd) — read it before assuming any deployment behavior, don't run it
against a live server without confirming with the user first.

There is no frontend build step. No Tailwind, no npm/node anywhere in the Django project (a hand-authored CSS design system lives in `static/css/`); GSAP/AOS/Swiper/Lenis are loaded via CDN `<script>` tags in `templates/base.html`. `mobile_app/` is a separate Flutter project (its own `pubspec.yaml`/`flutter` tooling) — treat it as independent of the Django app's Python/JS conventions.

## Architecture

One Django project (`GlamourAtHome/`) serving **four distinct surfaces**, routed by URL prefix:

| Surface | URL prefix | Who | Views |
|---|---|---|---|
| Marketing landing page | `/` | public | `core/views.py::index` |
| Customer booking app | `/booking/` | customers | `core/views.py`, `bookings/views.py`, `accounts/views.py` |
| Owner/admin dashboard | `/dashboard/` | `owner` group | `core/admin_dashboard_views.py` |
| Employee/beautician dashboard | `/employee/` | `emp` group | `core/employee_dashboard_views.py` |

### Apps

- **`core`** — marketing content models + views, `booking_data.py` (booking-app catalog/offers
  glue), both dashboards' views, `middleware.py` (role routing), `decorators.py`
  (`@owner_required`/`@owner_or_emp_required`), `context_processors.py` (injects `SITE` brand
  constants + role flags + sidebar counts into every template).
- **`accounts`** — `Profile`/`Address`/`Employee`/`EmployeeLeave` models, the allauth
  `AccountAdapter`/custom forms, phone-OTP login views (`phone_login_views.py` +
  `messagecentral.py`).
- **`catalog`** — `Category`/`Service`/`ServiceVariant`/`Package` models. A service can have
  several priced/duration `ServiceVariant`s; a `Package` has its own price/mrp/duration directly
  plus an `included_services` M2M to `Service` (never to another `Package`) — these are genuinely
  separate models, not one table with a kind discriminator.
- **`bookings`** — `Booking`/`BookingItem`/`Review`/`Offer` models, checkout, Razorpay
  integration (`razorpay_client.py`), PDF invoices (`invoice.py`, via `reportlab`).
- **`api`** — small REST-style endpoints (serviceability check, categories, services) consumed by
  the mobile app and/or booking-app JS.

### Roles — Django Groups, never `is_staff`/`is_superuser`

Three groups: `owner` (full dashboard access, grantable only from `/admin/` by a superuser),
`emp` (employee dashboard only, auto-assigned when an owner creates a beautician login),
`customer` (auto-assigned on self-signup). `is_staff`/`is_superuser` are reserved for real Django
admin-site access and must never gate dashboard access — see the docstring in
`core/decorators.py` for the incident this rule prevents. `core/middleware.py`'s
`RoleRedirectMiddleware` keeps an authenticated owner/emp out of the customer-facing marketing/
booking app on every request (not just at login); superusers are exempt and can browse anywhere.

### Data & storage

- **Database**: Postgres when `.env` sets `DB_HOST` (via `python-decouple`), SQLite otherwise —
  see the `DATABASES` block in `GlamourAtHome/settings.py`. No mode flag beyond that env var; real
  Postgres creds in a local `.env` means that machine writes straight to that database.
- **Media**: all user-uploaded images (catalog, employee/face photos, job arrival photos,
  marketing content) go to Cloudinary (`STORAGES['default']`), not local disk — `MEDIA_ROOT` is
  only a fallback path Django's FileField API still wants defined.
- **Email**: Brevo via `django-anymail` when `BREVO_API_KEY` is set, else Django's console
  backend (prints instead of sending) — no other fallback.
- **Payments**: Razorpay (`RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`), client-callback-driven
  checkout in `bookings/views.py` + `bookings/razorpay_client.py`. Price is always recomputed
  server-side at checkout, never trusted from the client.
- **Phone OTP**: MessageCentral "Verify Now" (`accounts/messagecentral.py`) — set `OTP_GATEWAY=True`
  for real SMS; `False` (default) prints the OTP to the console instead.

### Auth

Three-tier priority, all via django-allauth plus custom code: Google/Apple OAuth first, phone-
number OTP second (MessageCentral, not allauth's own login-by-code, which is disabled), username/
email + password third. `accounts/adapter.py::AccountAdapter` handles group assignment on signup,
beautician-style username auto-generation, and phone-verification adapter hooks.

### Templates/static layout

- `templates/` — marketing page (`index.html` + `components/*.html`, one file per landing-page
  section, extends `base.html`), `booking/` (own layout, `booking_base.html`, not `base.html`),
  `admin_dashboard/`, `employee_dashboard/`, `allauth/` (overrides of allauth's own partials only).
- `static/css/` — marketing bundle is `variables.css → base.css → components.css → sections.css →
  animations.css → responsive.css` via `main.css` `@import`. `booking.css`, `auth.css`,
  `admin_dashboard.css`, `employee_dashboard.css` are separate bundles importing `variables.css`/
  `base.css` directly — don't assume one global stylesheet covers every surface.
- `static/js/` — `main.js`/`animations.js` (marketing), `booking.js` (exposes
  `window.GlamourBooking`, consumed by `booking_drawer.js`/`bookings_dashboard.js`/`profile.js`).

Every `<section>` in `templates/components/` needs a `section` class alongside its specific one
(defines vertical rhythm padding) — forgetting it was a real bug once. Backgrounds alternate
shade between consecutive sections by design; check neighbors if you reorder sections.
