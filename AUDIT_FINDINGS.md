# Codebase Audit — Bugs & Missing Features

**Date**: 2026-08-08
**Scope**: Full read-only audit across `core`, `accounts`, `catalog`, `bookings`, and the new `api` app — run as four parallel investigations (new `api` app; auth/accounts; booking/payments/catalog; admin & employee dashboards).

**Context at time of audit**: all `User`/`Booking`/package-`Service` data had just been wiped (intentional, user-confirmed). DB had 0 Users, 0 Bookings, 5 orphaned `Employee` rows (`user=NULL`), ~39 `kind='service'` Services, 0 packages. A large amount of validation/security/UI work had already landed this session (see `developed.md`) — this audit specifically looked for what's still wrong or missing *beyond* that work, not a re-review of it.

---

## 🔴 Critical — money & security

### 1. No Razorpay webhook

**Files**: `bookings/urls.py` (only 5 routes, none for webhooks); `GlamourAtHome/settings.py` (no `RAZORPAY_WEBHOOK_SECRET`)

The payment integration is 100% client-callback-driven — `create_booking` only ever gets called from the browser after Razorpay's Checkout.js `handler` callback fires. A customer who pays successfully on Razorpay's side but never returns to the tab (network drop, browser crash, closed tab before the callback fires) has paid real money with **zero Booking record created**, and there is no automatic recovery path. A webhook endpoint (verifying Razorpay's signature on `payment.captured`/`order.paid` events) is the standard fix — it can create/repair the booking server-side independent of whether the browser ever got the callback.

### 2. No `transaction.atomic()` in `create_booking` — ✅ FIXED 2026-08-08

**File**: `bookings/views.py`

`Booking.objects.create()` and `BookingItem.objects.bulk_create()` ran as two separate, unwrapped writes. Since `payment_status='paid'` is already verified and set *before* either write runs, a failure partway through (e.g. `bulk_create` raising on a bad row) left an **orphaned, already-paid Booking with zero items** — no service was actually booked despite real money changing hands.

Fixed: both writes now run inside `transaction.atomic()`, wrapped in a `try/except` that logs loudly (via a new module-level `logger`) and returns a clean `{'ok': False, ...}` 500 instead of a raw exception — with the log message calling out explicitly when payment was already collected (`razorpay_order_id`/`razorpay_payment_id` included), since there's still no webhook/reconciliation system (#1) to catch this any other way.

Verified: normal booking creation still succeeds; a simulated failure during `BookingItem.bulk_create` now rolls back the whole transaction (zero orphaned bookings, confirmed via `Booking.objects.count()` before/after) and returns a clean JSON error instead of a raw exception.

### 3. No refund logic anywhere

**Files**: `bookings/views.py::cancel_booking` (~370-391); `bookings/razorpay_client.py` (no refund function exists)

`cancel_booking` never touches `payment_status` and never calls any refund API. This directly contradicts the site's own advertised policy in `core/mock_data.py:472`: *"Cancellations are fully refunded when made 12+ hours ahead."* Customers who paid online and cancel in time are simply never refunded by the system as it stands.

### 4. Phone-OTP login bypasses `is_active` — ✅ FIXED 2026-08-08

**File**: `accounts/phone_login_views.py`

`confirm_phone_login` called Django's `login()` directly on the user found via `get_user_by_phone`, never going through `authenticate()`. Django's `ModelBackend.authenticate()` is what normally checks `user.is_active` — skipping it meant a **deactivated account with a phone on file could still fully log in** via the phone tier, even though the same account was correctly blocked logging in with a password.

Fixed: an explicit `if not user.is_active:` check now runs right before `login()`, showing "This account has been disabled. Contact support for help." and redirecting back to the phone-login request page instead of logging the user in.

Verified: a deactivated account with a valid, correctly-entered OTP is now blocked; an active account with the same flow still logs in and reaches `/booking/` (no regression).

### 5. `confirm_phone_login` missing an `is_authenticated` guard — ✅ FIXED 2026-08-08

**File**: `accounts/phone_login_views.py`

If a user was already logged in and, in the same browser session, a phone-verification code for a *different* number got confirmed (e.g. a shared/kiosk device, or a leftover tab), the session would silently switch to that other account. No check prevented an authenticated session from processing a phone-confirmation meant to establish a fresh login for someone else.

Fixed: `confirm_phone_login` now starts with the same `if request.user.is_authenticated:` guard `request_phone_login` already had — redirects to `/booking/` and clears any stale pending `phone_login` session state instead of processing the confirmation.

Verified: an authenticated session with a stale pending verification for a *different* (disabled) account's phone number, when POSTed to confirm, stays logged in as the original user (no switch) and the stale session state is cleared.

### 6. `/api/v1/services/` crashes on every call

**File**: `api/views.py:37`

```python
s.variants.values('id', 'name', 'price', 'duration_minutes', 'is_default')
```

`ServiceVariant` (`catalog/models.py:103-117`) has no `name` or `duration_minutes` fields — the real fields are `label` and `duration_mins`. Confirmed directly against the DB:

```
FieldError: Cannot resolve keyword 'name' into field. Choices are: booking_items, duration_mins, id, is_active, is_default, label, mrp, price, service, service_id, sort_order
```

This endpoint 500s unconditionally.

---

## 🟠 High

### 7. No idempotency guard on `create_razorpay_order` — ✅ FIXED 2026-08-08

**File**: `bookings/views.py:143`

Client-side double-click is disabled, but there's no server-side dedup — a client-timeout-then-retry (slow network, user refreshes) can produce **two separate, live, payable Razorpay orders** for the same cart with nothing tying them together or invalidating the first.

Fixed: the view now derives a stable signature (`sha256`) from the user's cart contents + coupon + computed total, and caches `{order_id}` against `razorpay_pending_order:<user_id>:<signature>` for 15 minutes. A repeat request with the exact same signature re-fetches that cached order from Razorpay and reuses it (via `razorpay_client.fetch_order`) as long as it hasn't already been paid — instead of minting a new one. A genuinely different cart (different signature) or a cached order that's already `status == 'paid'` always falls through to creating a fresh order, so a real second purchase or a stale/already-settled cache entry is never blocked or reused incorrectly.

Verified with three Django-test-client cases against a mocked Razorpay client: (1) two rapid identical-cart requests return the same `order_id` and only one order is created; (2) two requests with different cart contents each get their own distinct order; (3) a retried request whose cached order has since been marked `paid` correctly mints a new order rather than handing out the paid one again.

### 8. `CustomResetPasswordForm`'s username path skips the `is_active` filter — ✅ FIXED 2026-08-08

**File**: `accounts/forms.py:60-75`

The email-lookup branch (line 55, via `filter_users_by_email(..., is_active=True, ...)`) correctly filters to active users. The username-lookup branch added alongside it does not filter by `is_active` at all — inconsistent, and lets a **disabled account still receive a real, working password-reset link** via the username field even though the same account is correctly excluded via email.

Fixed: the username lookup now filters `User.objects.filter(username__iexact=username, is_active=True)`, matching the email branch.

Verified: for a deactivated account looked up by username, `form.users` is now empty (allauth's `PREVENT_ENUMERATION` default still reports the form as "valid" rather than revealing the account exists/is disabled — but with nobody in `self.users`, `ResetPasswordForm.save()` has no one to actually send a link to). An active account looked up by username still resolves correctly and gets its email into `cleaned_data['email']` — no regression.

### 9. `update_employee` doesn't sync the linked `User.email` — ✅ FIXED 2026-08-08

**File**: `core/admin_dashboard_views.py:565`

`update_employee` only ever writes `Employee.email`. Compare to `add_employee`/`generate_login` in the same file, which both explicitly sync `user.email = email` when creating a new login. The first time an admin edits an existing employee's email through "Edit Employee," `Employee.email` and `employee.user.email` **silently drift apart** — the login's actual email (used for password reset, uniqueness checks, etc.) stays stale.

Fixed: `update_employee` now pre-checks the new email against `User.objects.filter(email__iexact=email).exclude(pk=employee.user_id)` (same duplicate-email guard `add_employee`/`generate_login` already have), then — inside the same `transaction.atomic()` block as the `Employee` save — updates `employee.user.email` too whenever it differs and a linked login exists.

Verified: editing an employee's email now updates both `Employee.email` and `employee.user.email` together; attempting to reuse another account's email is rejected with an error and neither row changes.

### 10. Self-service phone edit doesn't normalize the number — ✅ FIXED 2026-08-08

**File**: `accounts/views.py:30-43`

`profile_view`'s phone field is saved with only a loose digit-count check (`looks_like_phone`) — it never runs the value through `IndianPhoneField`'s `+91`-auto-prepend logic the way signup does. A customer who edits their phone number in their profile without typing `+91` ends up with a number stored in a different format than what `get_user_by_phone` expects at login time — **silently breaking phone-OTP login** for that account going forward.

Fixed: `profile_view` now runs the submitted phone through the same `IndianPhoneField` signup already uses (`IndianPhoneField(required=False).clean(phone)`) — auto-prepending `+91` and enforcing E.164 — before the uniqueness check and save, instead of the old loose `looks_like_phone` sanity check.

Verified: submitting a bare 10-digit number (`9876543210`) now saves as `+919876543210`, matching what phone-OTP login looks up; obviously-invalid input (`"call me maybe"`) is rejected with an error and the phone field is left unchanged.

---

## 🟡 Medium

### 11. Admin bookings list filters don't compose — ✅ FIXED 2026-08-08

**File**: `templates/admin_dashboard/bookings_list.html:6, 31`

- The search/date GET form (line 6) has no hidden `status` field — submitting a search or picking a date silently resets the status filter back to "all."
- The status filter tabs (line 31) only carry forward the `q` search param, never `date` — clicking a status tab silently drops an active date filter.

Filters cannot be reliably combined in either direction; whichever you touch last wins and clears the others.

Fixed: the search/date form now has a hidden `<input name="status" value="{{ status_filter }}">`, and all five status tabs now append `&date={{ date_filter }}` (when set) alongside the existing `&q={{ search_query }}`.

Verified: loading the page with `?status=completed` renders the hidden status field with that value; loading with `?status=all&date=2026-08-08` renders every other tab's href carrying `date=2026-08-08` forward.

### 12. Destructive-ish actions with zero confirmation — ✅ FIXED 2026-08-08

**Files**: `templates/admin_dashboard/services_list.html:86` (`toggle_service`); `templates/admin_dashboard/employees_list.html:81` (`toggle_status`)

Both `delete_service`/`delete_variant` on the same `services_list.html` page just got `adminConfirm()` modals this session — but the "Enable/Disable" service toggle and the employee "Mark Leave/Mark Active" toggle right next to similarly-consequential actions still have no confirmation step at all. Lower stakes than an outright delete, but a misclick silently disables a live service or marks an employee unavailable.

Fixed: both toggle forms now go through the same `adminConfirm()` modal pattern already used for delete actions, with a message that names the actual resulting state (e.g. "disable" vs "enable", "on leave" vs "active") rather than a generic "Are you sure?".

Verified: both pages render the `adminConfirm(...)` call with the correct dynamic wording for the current state.

### 13. Several allauth pages are still unstyled — ✅ FIXED 2026-08-08

**Files**: no override exists for: `password_reset_from_key.html` (the actual "set new password" page reached from the reset email), `password_change.html`, `password_set.html`, `email.html` (email management), `reauthenticate.html`, `socialaccount/connections.html`

Root cause: the `{% element %}` system's `field.html`/`fields.html`/`form.html` templates were never overridden in `templates/allauth/elements/`, only `h1`/`h2`/`p`/`button`/`alert`/`hr`/`provider(_list)` were. Every allauth page that renders a real form (not just headings/buttons) falls back to bare, unstyled `.as_p` output — visually broken inside the otherwise fully-branded auth card. **`password_reset_from_key.html` is the highest-priority one of these**, since it's reached directly from the password-reset email every user will eventually use.

Fixed at the root cause rather than per-page: added `templates/allauth/elements/field.html`, `fields.html`, and `form.html` overrides that render every text/email/password/checkbox/radio field with the same `auth-group`/`auth-label`/`auth-input`/`auth-field-errors` classes the hand-written login/signup/password-reset pages already use — so all six pages above (none of which needed their own page-template override) pick up the branded styling automatically, the moment they go through allauth's own `{% element fields %}`/`{% element form %}` calls. Also added a `badge.html` override (the "Verified"/"Unverified"/"Primary" pills on `email.html` and the provider badges on `connections.html`) and refined `button.html` so secondary/danger actions (e.g. `email.html`'s "Remove") render as ghost buttons instead of looking identical to the primary CTA. New supporting CSS in `auth.css`: `.auth-radio-row*` (the email/connections list rows), `.auth-badge*`, `.auth-card__form-actions`, `.auth-card__subtitle`, `.is-invalid`, `.sr-only`.

Verified end-to-end with real Django-test-client flows against all six pages: password-reset-from-key (via a real emailed reset link, through to an actual password change), password-change, password-set (unusable-password account), reauthenticate, email management (radio rows + badges + add-email field all render, confirmed with one verified and one unverified address), and account-connections — each returns 200 with the expected `auth-input`/`auth-radio-row`/`auth-badge` markup present. Confirmed no regression on the already-styled login/signup/password-reset-request pages (none of which use the `{% element %}` system, so they were never at risk, but checked anyway).

---

## Missing features

### Auth / accounts

- No MFA/2FA anywhere (`allauth.mfa` not installed).
- ~~No "reset employee password" admin action~~ — ✅ IMPLEMENTED 2026-08-08. Added a `reset_password` action to `dashboard_employees` (`core/admin_dashboard_views.py`) — only available once `employee.user` exists (the complement of `generate_login`, which only works while it doesn't). Reuses the same "Firstname + 4 random digits" scheme as a brand-new login (extracted into `_generate_temp_password()`), shown once via the success message, same "can't be shown again" pattern as `generate_login`. Verified: resetting changes the stored password hash and the old password stops working; attempting it on an employee with no login yet shows a clear error instead of erroring.
- ~~No way to disable an employee's *login* specifically~~ — ✅ IMPLEMENTED 2026-08-08. Added a `toggle_login` action flipping `employee.user.is_active` directly, independent of `Employee.status` (deliberately kept orthogonal — "on_leave" stays a pure scheduling signal, it does not also lock someone out; "disable login" is its own explicit control for when that's actually the intent). New "Disable Login"/"Enable Login" button plus a "🔒 Login disabled" indicator next to the status badge when applicable, both behind an `adminConfirm()` prompt. **Caveat, consistent with how `is_active` already behaves everywhere else in this codebase**: this blocks *future* logins (`ModelBackend.authenticate()`'s own `is_active` check) but does not force-terminate an already-active session — same limitation Django's `is_active` flag has by default project-wide, not something new introduced here. Verified: toggling flips `is_active` and the message reflects the new state; a disabled login can no longer authenticate with its correct password; toggling on an employee with no login shows a clear error.
- ~~No resend-cooldown countdown UI on phone-OTP~~ — ✅ IMPLEMENTED 2026-08-08. `accounts/phone_login_views.py` now stamps a `sent_at` timestamp into the session on both the initial send and every resend; `templates/account/phone_login_confirm.html` renders it as a `data-otp-sent-at` attribute and a small inline script disables the "Request new code" button with a live "Resend in Ns" countdown (30s) computed from that timestamp — client-side UX only, the real enforcement stays the existing server-side `ACCOUNT_RATE_LIMITS['phone_login_resend']` (5/min). Persists correctly across the resend form's own page reload since the timestamp is session-backed, not just in-memory JS state. Verified: the initial request and each resend both stamp/refresh `sent_at`, and the confirm page renders the expected data attributes for the script to read.
- No "forgot username" flow (low severity — email/phone login cover the same need).

### Booking / payment

- No real email/SMS sent to customers on booking status changes (assigned, on the way, completed) — only an in-app mock notification bell (`core/booking_data.py::get_notifications_mock()`). The one real SMS gateway (MessageCentral) is scoped to login OTP only; email backend is console-only (dev).
- ~~No invoice/receipt download for customers~~ — ✅ IMPLEMENTED 2026-08-08. Added `bookings/invoice.py::generate_booking_receipt_pdf()` (using `reportlab`, already a declared-but-unused dependency in `requirements.txt`) and a `booking_invoice` view/URL gated on `payment_status == 'paid'` — there's nothing to hand a receipt for on a still-pending pay-at-home order. A "🧾 Download Receipt" link appears on `bookings_dashboard.html` for any paid booking. The PDF reprints the booking's own already-frozen amounts (subtotal/discount/total, itemized) rather than recomputing anything. Verified: a paid booking downloads a real PDF (`%PDF` header, correct filename); an unpaid booking redirects with a clear message instead of generating a bogus receipt; another user's booking_number 404s (ownership-scoped, same pattern as `cancel_booking`).
- ~~No search or date filter for customers on `bookings_dashboard.html`~~ — ✅ IMPLEMENTED 2026-08-08. Added a search input (matches booking number, item names, or address — computed server-side once per booking as `booking.search_blob`) and a date input, both combining with the existing status tabs (AND, not OR) via a rewritten `initBookingFilters()` in `bookings_dashboard.js` (was `initBookingTabs()`) — same client-side `is-hidden` toggling the tabs already used, since a customer's own booking history is small enough that this doesn't need a server round-trip. Verified: the search/date data attributes render correctly and the search blob is correctly lowercased for case-insensitive matching.
- Employees have no decline/reject/unassign path for a booking — assignment is entirely admin-driven with no employee-side pushback.
- No commission/payout field anywhere in `accounts/models.py` — the "Earnings Total" shown to employees (`templates/employee_dashboard/emp_dashboard.html:133-137`) is just the gross booking total, not an actual payout figure.

### Admin dashboard

- No audit trail — neither `Booking` nor `Employee` has an actor/`updated_by` field, no `AuditLog` model exists. Every status/payment/assignment change is anonymous — no way to see *which* staff member did what.
- No bulk actions anywhere — every POST handler operates on exactly one `booking_id`/`service_id`/`employee_id` at a time.
- ~~No pagination on the bookings/services/employees list views~~ — ✅ IMPLEMENTED 2026-08-08. Added a shared `paginate_queryset()` helper (`core/utils.py`, 20/page) used by all three views; a new `templates/admin_dashboard/partials/pagination.html` partial renders Prev/Next + "Page X of Y" and carries the current filters/search/sort forward via `?page=N&<other_params>`. Out-of-range or non-numeric `?page=` clamps to a valid page instead of 404ing. Verified: 25 bookings / 22 services / 23 employees each correctly split across pages, filters (`status=upcoming`) survive into the pagination links, and a `?page=999` request still returns 200.
- No CSV/data export for bookings or revenue.
- ~~`assign_beautician`'s dropdown only shows an employee's overall status~~ — ✅ IMPLEMENTED 2026-08-08. Added `_annotate_beautician_conflicts()` (`core/admin_dashboard_views.py`) — for the bookings on the current page, it finds every other non-cancelled booking on the same date and flags an employee as conflicting if their time window overlaps (regular bookings use `Booking.SLOT_CHOICES`' fixed morning/afternoon/evening windows; urgent bookings use `exact_time` + the sum of their items' `duration_snapshot`). The dropdown now appends " — ⚠ Time conflict" to any employee already booked over that window, in addition to their existing active/on_leave/inactive status. Only computed for the current page's bookings, not the whole table, so it stays cheap under the new pagination. Verified: same-slot same-day double-booking flags correctly, different slots don't, a cancelled conflicting booking is correctly ignored, an urgent booking overlapping a regular slot is detected, and an employee already assigned to a booking doesn't get flagged as conflicting with themselves.

### Catalog

- Homepage "Packages" section (`core/booking_data.py`, feeding `templates/components/packages.html`) currently renders **empty** — expected fallout from the recent full data wipe (all packages were deleted), not a new code bug, but worth fixing (i.e. creating at least one package) before any demo/screenshot.

### `api` app (new — Flutter mobile scaffold)

Per `mobile_app_plan.md:58-67`, this is early groundwork for a planned Flutter app: plain Django views (no DRF, not installed), 3 read-only unauthenticated GET endpoints (`serviceability`, `categories`, `services` — the last one is the broken one, see #6 above). No models/serializers/tests/migrations of its own — everything currently lives in one flat `api/views.py` rather than the `auth_views.py`/`booking_views.py`/etc. structure the plan document describes. No auth/token layer, no write endpoints, no CORS configuration. Roadmap checklist in `mobile_app_plan.md:82-95` shows most of Phase 2-4 unchecked (auth flow, booking creation, live tracker, integration testing). This isn't a duplicate/abandoned effort — it's genuinely early-stage, consistent with the plan doc — but nothing beyond basic catalog browsing is functional yet.

---

## Suggested priority order

1. Fix the three payment-integrity issues together (#1 webhook, #2 atomic transaction, #3 refunds) — these are the ones with direct financial exposure.
2. Fix the two auth bypass issues (#4 `is_active` on phone login, #5 missing auth-guard on phone confirm) and the reset-form inconsistency (#8) — session/account-integrity risks.
3. Fix `/api/v1/services/` (#6) — trivial one-line field-name fix, currently 100% broken.
4. Fix the two silent-drift bugs (#9 employee email, #10 phone normalization) — low effort, prevents confusing future support issues.
5. Everything else (filter composition, missing confirmations, unstyled pages, and the "missing features" list) can be scheduled based on product priority — none of it is actively losing money or leaking access the way items 1–6 are.
