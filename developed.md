# developed.md — project brain

Read this first. It's written so an agent (or a new dev) can get full context
in one pass without re-reading every file. Update it whenever architecture,
data flow, or scope changes.

## Current state (as of 2026-08-11)

Everything below "What this is" is a **chronological changelog** — dated
sections, oldest first, each explaining a *why* at the time it was
written. It is not re-edited once superseded, so several early sections
describe things that no longer exist (e.g. "Catalog & Bookings models"
describes a single `Service` model with a `kind` field — split into
real separate `Service`/`Package` models later; "Package Services
Auto-Calculation Backend & DB" describes a `PackageVariant` model —
removed later still). Treat the changelog as history/rationale, not as
a schema reference. **This section is the one place meant to stay
accurate** — update it whenever models, roles, or major URLs change,
the same way you'd update a README.

- **What it is**: Elix, an on-demand home beauty service. Four
  surfaces in one Django project: the marketing landing page (`/`),
  the real booking app (`/booking/`), the owner dashboard
  (`/dashboard/`), and the employee/beautician dashboard (`/employee/`).
- **Stack**: Django, django-allauth for auth, Razorpay for payments,
  Cloudinary for all user-uploaded images, hand-authored CSS (no
  Tailwind/build step — see "Why no Tailwind" below), GSAP/AOS/Swiper/
  Lenis via CDN on the marketing page.
- **Database**: Postgres when `.env` has real server DB creds (`DB_HOST`
  set — see `GlamourAtHome/settings.py`), SQLite otherwise. No mock data
  anywhere in the codebase — every dynamic-looking section, including
  the marketing landing page's decorative content, is a real model.
- **Apps**: `core` (marketing views + models — hero/testimonials/
  gallery/etc., owner + employee dashboard views, shared
  `booking_data.py`), `accounts` (`Profile`/`Address`/`Employee`/
  `EmployeeLeave` models, the auth adapter/forms/phone-login views),
  `catalog` (`Category`/`Service`/`ServiceVariant`/`Package` models),
  `bookings` (`Booking`/`BookingItem`/`Review`/`Offer` models, checkout,
  Razorpay, reviews, invoices), `api` (a handful of small REST-style
  endpoints: serviceability, categories, services).
- **Roles**: three Django `Group`s — `owner` (full dashboard access,
  grantable only from the Django admin site by a superuser), `emp`
  (employee dashboard only, assigned automatically when an owner
  creates a beautician login), `customer` (assigned automatically on
  self-signup). Enforced via `core/decorators.py`
  (`@owner_required`/`@owner_or_emp_required`) and
  `core/middleware.py::RoleRedirectMiddleware`. **Never** gated on
  `is_staff`/`is_superuser` — those stay reserved for real
  Django-admin-site access.
- **Catalog models** (`catalog/models.py`) — `Category` (slug, name,
  description, image). `Service` + `ServiceVariant`: a service can have
  several priced/duration options (e.g. different wax types), each a
  separate `ServiceVariant` row. `Package`: its own `price`/`mrp`/
  `duration_mins` fields directly (no separate variant model — a
  package only ever has one sellable price in practice) plus
  `included_services`, an M2M to `Service` (never to another
  `Package`). `Service` and `Package` are genuinely separate
  tables/models, not one table with a kind discriminator.
- **Bookings models** (`bookings/models.py`) — `Booking` (snapshotted
  address + pricing, status workflow, OTP arrival gate, Razorpay
  fields). `BookingItem` (exactly one of `service_variant`/`package`
  is set, both `SET_NULL`, plus frozen name/price/duration snapshots so
  a past booking never changes if the catalog does). `Review` (exactly
  one of `service`/`package` set, one star rating per `BookingItem`).
  `Offer` (coupon codes, used at checkout).
- **Marketing content models** (`core/models.py`) — the landing page's
  hero, value pillars, how-it-works steps, trust points/badges,
  beauticians, testimonials, gallery (before/afters + portfolio),
  beauty tips, and FAQs are all real, admin-editable models now
  (`Hero`/`ValuePillar`/`HowItWorksStep`/`TrustPoint`/`TrustBadge`/
  `Beautician`/`Testimonial`/`GalleryBeforeAfter`/`GalleryPortfolioItem`/
  `BeautyTip`/`FAQ`), plus `SiteNotification`/`TrendingSearch` backing
  the booking app's notification bell and trending-search chips.
- **Auth**: three-tier priority — Google/Apple OAuth first, phone-number
  OTP second (real MessageCentral integration,
  `accounts/messagecentral.py`), username/email + password third. A
  custom `AccountAdapter` (`accounts/adapter.py`) handles role
  assignment on signup, beautician-style username auto-generation, and
  the phone-verification adapter hooks allauth needs.
- **Admin dashboard** (`/dashboard/`, owner-only) — Overview, Bookings,
  Services, **Packages** (its own page, own model, own add/edit form —
  not a filtered view of Services), Employees, Categories, Offers.
- **Employee dashboard** (`/employee/`) — assigned job cards, status
  workflow, arrival-photo + start-OTP gate.
- **Customer booking app** (`/booking/`) — catalog browse/search/
  filter/sort, cart (`localStorage`), checkout (Razorpay or pay-at-home,
  price always recomputed server-side), a "my bookings" dashboard
  (rebook, star reviews, PDF invoice, cancel), express/urgent same-day
  booking with a 50-minute advance-notice rule.

## What this is

A premium, single-page marketing/landing site for **Elix** ("Premium Salon
at Home"), an on-demand home beauty service (verified beauticians +
premium products, delivered to the customer's home). Built with **Django
templates only** — no React/Vue, no frontend build step. Goal of this
phase is explicitly **not booking** — it's brand trust, lead capture
(contact form), and app installs. Every dynamic-looking section is
architected to later swap its data source for a REST API without touching
HTML structure.

A second, structurally distinct page now exists alongside it: **`/booking/`**,
the actual booking application (catalog browsing + cart, Phase 1 of 3 — see
"Service Booking App" further down). Everything in this section and up
through "Placeholders" below describes the marketing page only; don't
assume it applies to the booking app.

## Stack

- Django 6.0 (see `requirements.txt`), Python 3.12, SQLite (untouched default —
  no custom models exist yet).
- Styling: **hand-authored CSS design system** (`static/css/*.css`), not
  Tailwind/Bootstrap. Chosen deliberately — see "Why no Tailwind" below.
- Motion: GSAP + ScrollTrigger, AOS, Swiper, Lenis — all via CDN `<script>`
  tags in `templates/base.html`. No npm/node involved anywhere in this repo.
- Three.js / Spline / Lottie: **not wired in**. Base.html has a commented-out
  CDN line for Lottie/Three if a future section needs a real `.json`/`.glb`
  asset — don't add the `<script>` tag until there's an actual asset to load.

### Why no Tailwind

Tailwind's CDN "play" build has no purge (ships everything, slow) and a real
Tailwind build needs a Node toolchain, which conflicts with "no build step,
just `runserver`". A bespoke token-based CSS system (`variables.css` →
`base.css` → `components.css` → `sections.css` → `animations.css` →
`responsive.css`, all pulled in via `main.css` `@import`) gave full control
over the "no template-looking sections" requirement and keeps `pip install && runserver` as the only setup step. If this project later adopts a JS
framework/build pipeline, Tailwind becomes reasonable again — until then,
don't reintroduce it without also solving the build-step problem.

## Run it

```bash
source venv/bin/activate
pip install -r requirements.txt
python manage.py runserver
```

No migrations are required to view the page (only Django's built-in auth/admin
tables exist). Verified working: `/`, `/robots.txt`, `/sitemap.xml`, and all
static assets return 200 (last checked 2026-07-24).

## Folder map

```
GlamourAtHome/settings.py   INSTALLED_APPS=['core', 'accounts', 'catalog', 'bookings', django-allauth apps],
                            TEMPLATES DIRS=[BASE_DIR/'templates'], STATICFILES_DIRS=[BASE_DIR/'static'],
                            SITE_* constants (brand info) — see "Authentication" for the allauth config block
GlamourAtHome/urls.py       'accounts/' -> allauth.urls, '' -> bookings.urls (POST /services-booking/book/),
                            includes core.urls at '/', serves static in DEBUG

catalog/                    Category/Service/ServiceVariant models + admin — the
                             booking catalog's real backing store. See "Catalog &
                             Bookings models". migrations/0002 seeds the 12-item catalog.
bookings/                   Booking/BookingItem models + admin + create_booking view/
                             urls (POST /services-booking/book/). See "Catalog &
                             Bookings models".

core/
  mock_data.py              *** THE FILE TO EDIT FOR MARKETING PAGE CONTENT ***
                             One get_*() function per section. Each docstring
                             names the future REST endpoint it stands in for.
  booking_data.py           Same convention as mock_data.py, but for the Service
                             Booking app (/services-booking/) — get_booking_categories()/
                             get_booking_catalog() now query catalog/'s models (same
                             return shape as before); offers/notifications/trending
                             searches remain genuine mock data.
                             See "Service Booking App" section below.
  views.py                  index() builds one big context dict from mock_data.
                             services_booking() does the same from booking_data,
                             renders booking/pages/service_booking.html.
                             robots_txt() / sitemap_xml() are hand-rolled views
                             (no django.contrib.sitemaps — few pages, not worth it
                             yet; revisit if blog/beautician detail pages are added).
  context_processors.py     site_meta() — injects `SITE` (name/phone/email/social/
                             app links) into every template from settings.py constants.
  templatetags/glamour_extras.py   `times` filter — {% for _ in n|times %} to repeat
                             a block n times (used for star ratings, QR mock grid,
                             booking catalog skeleton cards).
  urls.py                   '', 'services-booking/', 'robots.txt', 'sitemap.xml'

templates/
  base.html                 <head> via partials/meta.html, preloader, navbar, {% block
                             content %}, footer, JSON-LD schema, then vendor CDN <script>
                             tags (gsap, ScrollTrigger, aos, swiper, lenis) + main.js/animations.js
  index.html                extends base.html; includes all 13 components in order,
                             passing each its slice of context by name
  sitemap.xml                template rendered by views.sitemap_xml
  partials/                  meta.html (SEO/OG/Twitter/fonts), navbar.html, footer.html,
                             preloader.html, schema.html (LocalBusiness + FAQPage JSON-LD)
  components/                 one file per marketing-page section — see "Section map" below
  booking/                  Service Booking app templates — own layout, not base.html.
                             See "Service Booking App" section below for the full map.
    layouts/booking_base.html
    pages/service_booking.html
    components/              app_navbar, bottom_nav, search_bar, filter_sidebar, sort_bar,
                              catalog_grid, catalog_card, quick_view_modal, floating_cart,
                              notifications_dropdown, profile_dropdown, chat_panel,
                              booking_drawer (Phase 2 — 5-step booking flow)
  allauth/                  Overrides of django-allauth's own template partials, not
                             full pages — see "Authentication" section below.
    layouts/base.html         page shell (logo, centered .auth-card) every account
                               page extends, in place of allauth's unstyled default
    elements/                 h1/h2/p/hr/alert/button/button_group/provider/
                               provider_list.html — the small partials allauth's
                               login/signup/password-reset pages are built from

static/
  css/  variables.css (design tokens, incl. booking app's --z-* tokens) → base.css
        (reset/typography/a11y) → components.css (buttons/chips/nav/cards/forms/footer) →
        sections.css (bespoke per-section layout — the bulk of the marketing page's visual
        design) → animations.css (preloader/cursor-glow keyframes) → responsive.css
        (breakpoint overrides not already mobile-first inline)
        all pulled together by main.css via @import — marketing page only.
        booking.css and auth.css are SEPARATE bundles (import variables.css +
        base.css [+ components.css for auth.css] directly) — see "Service
        Booking App" and "Authentication" sections below.
  js/   main.js        library bootstrapping: preloader, Lenis+ScrollTrigger wiring,
                        navbar scroll/burger state, AOS.init, Swiper instances,
                        service category filter, FAQ accordion, contact/newsletter
                        form handlers (simulated success — no backend yet), cursor glow,
                        theme toggle (shared with the booking app — see below)
        animations.js   bespoke motion: hero canvas orb background, hero headline
                        GSAP reveal, count-up stats (IntersectionObserver + GSAP),
                        "why us" sticky-frame swap (IntersectionObserver), how-it-works
                        scroll-scrubbed line + staggered step reveal (ScrollTrigger),
                        before/after drag sliders, subtle card tilt on hover
        booking.js      SEPARATE bundle for the booking app — catalog filter/sort/
                        search, wishlist, quick view, cart, chat FAB, dropdowns, ripple,
                        toasts. Exposes window.GlamourBooking for booking_drawer.js.
        booking_drawer.js   Phase 2 — booking drawer: step navigation/validation,
                        hand-rolled calendar, Leaflet+OpenStreetMap address map,
                        localStorage addresses, simulated payment, confirmation.
                        See "Service Booking App" section below.
  images/ favicon.svg, og-cover.svg — placeholder brand marks (see "Placeholders" below)
```

## Section boundaries — every section needs `class="section"`

`base.css` defines a `.section` utility (`padding-block: var(--space-3xl)`,
i.e. the vertical gap that makes one section visually end and the next
begin). Every `<section>` in `templates/components/` (except `hero.html`,
which manages its own rhythm via `min-height: 100svh`) must carry this class
alongside its specific one, e.g. `class="packages section"`. Forgetting it
was a real bug caught 2026-07-24 — sections had zero vertical padding and
ran together with no visible break. If you add a new section, add the class.

Backgrounds are also deliberately alternated so no two consecutive sections
share a shade (`cream` → `white` → `cream-deep` → `white` → `cream` →
`ink`(trust) → `cream-deep` → `white` → `cream` → `cream-deep` →
`ink`(download) → `white` → `cream-deep` → `ink`(footer)). If you reorder or
insert a section, re-check its neighbors don't collide on background color.

## Section map (order on the page)

| #  | Section                | Template                              | Context var(s)                                | Mock data source                                          |
| -- | ---------------------- | ------------------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| 1  | Hero                   | `components/hero.html`              | `hero`                                      | `get_hero()`                                            |
| 2  | Why Glamour At Home    | `components/why_us.html`            | `value_pillars` (as `pillars`)            | `get_value_pillars()`                                   |
| 3  | Featured Services      | `components/featured_services.html` | `service_categories`, `featured_services` | `get_service_categories()`, `get_featured_services()` |
| 4  | Beauty Packages        | `components/packages.html`          | `packages`                                  | `get_packages()`                                        |
| 5  | How It Works           | `components/how_it_works.html`      | `how_it_works` (as `steps`)               | `get_how_it_works()`                                    |
| 6  | Why Customers Trust Us | `components/trust.html`             | `trust_points`, `trust_badges`            | `get_trust_points()`, `get_trust_badges()`            |
| 7  | Meet Our Beauticians   | `components/beauticians.html`       | `beauticians` (as `artists`)              | `get_beauticians()`                                     |
| 8  | Customer Stories       | `components/testimonials.html`      | `testimonials` (as `stories`)             | `get_testimonials()`                                    |
| 9  | Gallery                | `components/gallery.html`           | `gallery`                                   | `get_gallery()`                                         |
| 10 | Beauty Tips            | `components/beauty_tips.html`       | `beauty_tips` (as `tips`)                 | `get_beauty_tips()`                                     |
| 11 | Download App           | `components/download_app.html`      | (uses global`SITE.apps`)                    | —                                                        |
| 12 | FAQs                   | `components/faqs.html`              | `faqs`                                      | `get_faqs()`                                            |
| 13 | Contact                | `components/contact.html`           | (uses global`SITE`)                         | —                                                        |
| 14 | Footer                 | `partials/footer.html`              | (uses global`SITE`)                         | —                                                        |

Each section root element has a `data-api="/api/v1/..."` attribute matching
its mock function's docstring — grep for `data-api` to find every future
integration point in one pass.

## Navbar — reduced to two focal CTAs (added 2026-07-29)

The marketing navbar (`partials/navbar.html`) was deliberately trimmed:
desktop/mobile nav links dropped from 6/7 down to 4 (Services, Packages,
How It Works, Stories — Beauticians/FAQs/Contact are still real page
sections, just no longer in the nav/drawer; reachable by scrolling or
direct anchor), and the actions area now has exactly two CTAs instead of
"Contact" + "Get the App": **Download App** (`btn--ghost` → `#download-app`)
and **Book Now** (`btn--primary` → `{% url 'services_booking' %}`). If more
nav items get added later, keep re-asking "does this belong in the two-CTA
focus, or is it better as a page-in-page anchor" rather than letting the
action area grow back to 3+ competing buttons.

## Marketing → Booking cart handoff (added 2026-07-29)

"Book Now" (`components/featured_services.html`) and "Choose `<package>`"
(`components/packages.html`) no longer link to `#contact` — they add the
item to the Service Booking app's cart and hand off to
`/services-booking/`, landing with the mini-cart already open.

- **Why this works with zero lookup/mapping table**: `mock_data.py`'s
  `get_featured_services()`/`get_packages()` item `id`s (`hair-spa`,
  `glow-facial`, `bridal-makeup`, `gel-manicure`, `thai-massage`,
  `keratin-smoothing`, `essential`, `signature`, `indulgence`) were chosen
  to match `core/booking_data.py`'s catalog `id`s exactly. **This id
  parity is now a real cross-file contract, not a coincidence** — if either
  file's ids are ever renamed/added independently, this handoff silently
  breaks (the marketing CTA would add a non-existent id to the cart; the
  booking page would just skip rendering that line item). Keep the two
  id sets in sync, or add a lookup/validation step if they're ever allowed
  to diverge.
- **Mechanism**: each CTA is `<a href="{% url 'services_booking' %}?open_cart=1" data-add-to-booking-cart data-catalog-id="{{ item.id }}">`.
  `main.js::initMarketingBookButtons()` writes `{id, qty}` into the same
  `glamour_cart` localStorage key `booking.js` owns (incrementing `qty` if
  already present) on click, then lets the normal `<a>` navigation proceed
  — no `preventDefault`/manual redirect needed, since the localStorage
  write is synchronous. This duplicates ~8 lines of `booking.js`'s
  `addItem()` logic rather than importing it — the marketing and booking
  pages are deliberately separate JS bundles (see "Service Booking App"
  below), and a shared cart-write function isn't worth a new shared file
  for this little logic.
- **`?open_cart=1`**: `booking.js::initFloatingCart()` checks this query
  param after its initial `render()`, calls the mini-cart's own `open()`,
  and strips the param via `history.replaceState` so a later page refresh
  doesn't reopen it. This is what makes the item's arrival in the cart
  actually visible instead of a silent background write.
- If the marketing site ever needs to add an item type Booking doesn't
  carry (e.g. a future marketing-only bundle), either add it to
  `booking_data.py`'s catalog too, or give that specific CTA a plain
  `#contact` link instead of `data-add-to-booking-cart` — don't point
  `data-catalog-id` at an id the booking catalog doesn't have.

## API-ready data flow (how to plug in a real backend later)

1. Build the DRF endpoints matching the paths in `mock_data.py` docstrings
   (e.g. `GET /api/v1/services/featured/`).
2. In `core/views.py::index`, replace the relevant `mock_data.get_*()` call
   with a `requests.get(...)` (server-side render, easiest migration) — the
   template loops (`{% for service in services %}` etc.) don't change at all
   because the dict/list shape is already what the templates expect.
3. Alternative path: move the fetch client-side. Each section's `data-api`
   attribute is already there for a small JS loader to read and `fetch()`
   against, replacing server-rendered content on load. Either path works;
   pick server-side first (fewer moving parts) unless SPA-style partial
   reloads become a requirement.
4. `core/mock_data.py` is the **only** file that should need to change for
   this migration — that was the point of centralizing it there instead of
   inline dicts in `views.py`.

## Design system

- **Palette** (`static/css/variables.css`): warm espresso ink (`--ink #16120f`) + ivory (`--cream #faf6ef`) + champagne gold (`--gold #c9a15a`)
  - blush (`--blush #e9c8c2`). Gold = trust/luxury accent, used sparingly
    (CTAs, active states, numerals) — not a background color.
- **Type**: `Fraunces` (editorial serif, headings/display — italic used for
  emphasis via `<em>`) + `Inter` (body/UI), both loaded from Google Fonts in
  `partials/meta.html`. Fluid sizing via `clamp()` tokens (`--fs-display-xl`
  etc.) — no separate mobile/desktop font-size overrides needed.
- **No repeated layouts**: each of the 13 sections has a structurally
  distinct layout (sticky-scroll storytelling for "Why Us", horizontal
  scroll-scrubbed timeline for "How It Works", draggable before/after +
  masonry for "Gallery", fade-effect Swiper for testimonials, etc.) — this
  was an explicit requirement, don't collapse sections into a shared
  "content card grid" pattern when extending.
- **Accessibility**: skip-link, `:focus-visible` outlines, `aria-*` on
  interactive widgets (accordion, filters, carousels), `prefers-reduced- motion` disables/shortens all custom JS animation (canvas, GSAP, counters)
  — check this media query before adding new motion.

## Dark mode / theming (added 2026-07-25)

Toggled via `<html data-theme="light|dark">`, persisted to `localStorage`
('theme' key), defaulting to `prefers-color-scheme` when no stored value
exists. Two toggle buttons exist (`[data-theme-toggle]`): one in the navbar
(`navbar.html`), one in the mobile drawer header — both wired by
`initThemeToggle()` in `main.js`. An inline `<script>` at the very top of
`base.html`'s `<head>` (before any CSS) sets the attribute immediately, so
the page never flashes the wrong theme on load.

**Token architecture — this is the part to understand before touching
colors.** `variables.css` has two tiers:

- **Fixed tokens** (`--ink`, `--cream`, `--white`, `--ink-soft`, all
  gradients, `--border-hairline-dark`): **never** redefined by theme. These
  are used as *fixed contrast pairs* throughout the CSS — gold buttons
  (`--ink` text on a gold gradient that never changes), dark-accent hovers
  (`.chip.is-active`, `.btn--dark`, accordion-open icon — background flips
  to `--ink` regardless of theme), photo-overlay badges (category tags,
  before/after labels, the gallery compare-handle — see the "known gap"
  below), the hero (photo overlay) and navbar's default (unscrolled,
  over-photo) state, and the **footer + mobile drawer**, which stay dark
  regardless of theme by deliberate, still-current design choice (a common
  pattern — many sites keep the footer/off-canvas menu dark regardless of
  page theme). The phone-mockup illustration in the download section
  (`.phone-mock`, `.phone-mock__card`) is the same story: it's a fixed
  decorative graphic, not a real page surface, so it doesn't flip either.
- **Theme-aware tokens** (`--surface-1/2/3`, `--text-body`, `--text-soft`,
  `--accent-gold`, plus `--ink-muted` and `--border-hairline` which are
  redefined in place under the same names): these ARE redefined under
  `:root[data-theme="dark"]` in `variables.css`. `--surface-1/2/3` replace
  what used to be direct `var(--cream)`/`var(--white)`/`var(--cream-deep)`
  background usages on section/card surfaces; `--text-body` replaced
  `var(--ink)` as the default body/heading text color; `--text-soft`
  replaced the *text* (not background) uses of `--ink-soft` on
  chips/badges/feature lists; `--accent-gold` is `--gold-deep` in light
  mode / `--gold-light` in dark mode, for gold accents that need to stay
  legible against a surface that itself flips (trust/download eyebrows,
  stat values, badge indices — plain `--gold-light` washes out on a light
  background).

**Trust and Download-App *do* flip with theme** (changed 2026-07-25 — they
were originally in the fixed-dark list above, on the assumption they were
a deliberate "always dark accent" like Apple's occasional dark sections.
That reads as broken once a real toggle exists: a user in light mode
reasonably expects every section to go light). Their pattern: default
(light-mode) rule uses `--surface-3` + `--text-body` + `--accent-gold`;
a `[data-theme="dark"] .trust { background: var(--gradient-ink); }` (same
for `.download`) restores the original premium dark gradient look in dark
mode specifically, since that's a hardcoded gradient no variable
reference can flip automatically. If you touch these sections again,
keep both halves in sync.

If you add a new **light-surfaced** section or card: use `--surface-1/2/3`
for its background and `--text-body`/`--text-soft`/`--ink-muted` for text,
`--accent-gold` for gold accents — never `--cream`/`--white`/`--ink`/
`--gold-light` directly, or it won't flip in dark mode. If you add a new
**intentionally-always-dark** element (another photo overlay, another
fixed decorative graphic): use `--ink`/`--cream` directly, same as the
footer/drawer/phone-mock — it should look identical in both themes. And
watch for the specific trap that caused two real bugs already: an element
with no *explicit* color, relying on inherited body text — that inherited
color now varies by theme, so anything meant to keep fixed text (a white
photo-overlay badge, a card floating on a fixed-dark illustration) needs
an explicit fixed color, not silent inheritance.

`.theme-transitioning` (added to `<html>` by JS for ~450ms around a toggle
click) briefly makes every element's color/background/border transition,
so the switch fades instead of snapping — scoped to that one class rather
than a permanent global transition, so it doesn't fight component's own
hover/focus transitions. Skipped under `prefers-reduced-motion`.

**Known gap / acceptable scope boundary**: small accent/active-state
elements that pair `--ink`/`--cream` as backgrounds (chip.is-active,
btn--dark, accordion-open icon, the gallery compare-handle, photo-overlay
badges like service category tags and before/after labels) do **not**
invert between themes — they render identically in light and dark mode.
This was a deliberate scope call (see the fixed-tokens list above) rather
than an oversight; revisit only if it reads as a real visual bug in
practice, not just theoretical inconsistency.

## SEO

- `partials/meta.html`: title/description blocks (overridable per-template
  via `{% block title %}` / `{% block meta_description %}` if more pages are
  added), canonical, OG + Twitter card, Google Fonts preconnect.
- `partials/schema.html`: JSON-LD `LocalBusiness` (always) + `FAQPage`
  (only rendered when `faqs` is in context — currently only on the index page).
- `core/views.py`: `robots_txt` points to `sitemap_xml`; both are real views,
  not static files, so they stay in sync with `SITE_DOMAIN`/routes automatically.
- Semantic HTML throughout (`<section>`, `<article>`, `<blockquote>`,
  `<figure>`, heading hierarchy h1→h2→h3 per section).

## Performance notes

- `main.css` uses `@import` for dev clarity (six small, readable files).
  **Before shipping to production**, concatenate + minify the six files in
  `static/css/` into one request (any CSS bundler, or even `cat` + a minifier)
  — six `@import`s means six waterfall requests, fine for a client demo, not
  fine for a Lighthouse score.
- Vendor JS is loaded via CDN with no `defer` on GSAP/AOS/Swiper/Lenis
  (they must be present before `main.js`/`animations.js` run) — `main.js`
  and `animations.js` themselves *are* deferred. If perf profiling shows
  this blocking render, consider self-hosting + bundling instead of 5
  separate CDN round-trips.
- Hero canvas animation pauses on `document.hidden` and skips its RAF loop
  entirely under `prefers-reduced-motion`.
- Real photography (`static/images/*.jpg`) is wired in — all non-hero `<img>`
  tags carry `loading="lazy"`. Images were downloaded at moderate resolution
  and JPEG-recompressed (`sips -Z <max-dim> -s formatOptions 78`), not
  full-res originals — total `static/images/` is ~3.6MB across 30 photos.
  **Still TODO before a real Lighthouse pass**: serve responsive `srcset`s
  (currently one fixed size per `<img>`) and convert to AVIF/WebP with a
  JPEG fallback — the hero photo especially, since it's the single largest
  LCP-critical asset on the page and currently has no `loading="lazy"` (by
  design — it's above the fold) but also no responsive sizing yet.

## Placeholders — replace before real launch

- **Photography** (hero, why-us pillars, service cards, beautician
  portraits, gallery before/after + portfolio, blog covers) uses real free-
  license stock photos (Unsplash/Pexels — see `static/images/CREDITS.md` for
  the source of every file), not commissioned brand photography or actual
  Glamour At Home staff/clients. Swap these for real photography before
  launch — each image's static path lives in `core/mock_data.py` under a
  `photo` key (or `before_photo`/`after_photo` for gallery comparisons, or
  the `pillar-<slug>.jpg` convention for why-us, derived in
  `templates/components/why_us.html` from `pillar.image`). The `--tone`
  gradient classes (espresso/blush/gold/rose) in `sections.css` are still
  present as the fallback background behind every photo (visible briefly
  while an image loads, or if one 404s) — leave them in place even after
  swapping photos.
  - **Gallery before/after pairs specifically**: the two images per pair are
    *different* stock photos matched by theme (e.g. natural hair vs. styled
    hair), not a real single-person transformation — see the note in
    `static/images/CREDITS.md`. Replace with real, consented client
    before/after photography before making any results claim in actual
    marketing copy.
- `static/images/favicon.svg` and `og-cover.svg` are simple generated
  monogram/wordmark placeholders, not final brand assets.
- `download_app.html`'s QR code (`.qr-mock`) is a decorative fixed grid, not
  a real scannable code — generate a real one server-side (e.g. the
  `qrcode` package, already noted in `requirements.txt`) once a deep-link
  URL exists.
- Contact form and footer newsletter form both **simulate success client-
  side** (`main.js::initLeadForms`) — no backend persists these submissions
  yet. Wire to `POST /api/v1/leads/` and `/api/v1/newsletter/` respectively.
- `SITE_PHONE`, `SITE_EMAIL`, `SITE_ADDRESS`, `SOCIAL_LINKS`, `APP_LINKS` in
  `GlamourAtHome/settings.py` are placeholder values — real business details
  go there (single source of truth via `core.context_processors.site_meta`).
- `DEBUG=True` and the default Django `SECRET_KEY` in `settings.py` are
  dev-only; rotate the key and set `ALLOWED_HOSTS` before any real deploy.

## Service Booking App — `/services-booking/` (added 2026-07-27)

A second, structurally distinct page from the marketing landing page above:
the actual booking application (Urban Company/Airbnb/Zomato-style catalog +
cart + booking flow), not a scroll-page. Built in three phases; **Phase 1
and Phase 2 exist so far**.

- **Phase 1 (built):** app shell (desktop sticky nav + mobile bottom nav +
  chat FAB), full catalog browsing — search, filters, sort, quick view —
  and a persistent localStorage-backed cart. (The wishlist feature
  originally listed here was removed entirely on 2026-08-01 — services are
  booked immediately in this app, not saved for later, so it didn't fit
  the product; grep this file's history if it's ever needed again.)
- **Phase 2 (built, 2026-07-28):** the 5-step booking drawer (address →
  date → booking type/time → payment → summary/confirm), opened from the
  cart's "Proceed to Booking" button. **Built deliberately without real
  Google Maps or Razorpay keys** — the user explicitly declined to provide
  either — so the address step uses a free/keyless Leaflet+OpenStreetMap
  map instead of Google Maps, and payment is a simulated checkout instead
  of real Razorpay. This is not a temporary stopgap; see the dedicated
  subsection below before "upgrading" either.
- **Phase 3 (partial — bookings dashboard added 2026-08-01):** a real
  bookings dashboard at `/services-booking/bookings/` (see "Bookings
  dashboard" below). Still not built: full chat (AI/Support/FAQ tabs —
  Phase 1 only has a scripted single-reply preview) and a real
  notifications backend (still `get_notifications_mock()`). A "wishlist
  page" was on this list in earlier versions of this roadmap — no longer
  applicable, since the wishlist feature itself was removed (see Phase 1
  note above). "Review" (leaving a review on a completed booking) was also
  never built — there's no `Review` model; out of scope until asked for.

### Architecture

- **No new Django app** — the project stays single-app (`core`) by design.
  `core/booking_data.py` is a sibling to `mock_data.py` (same `get_*()`-per-
  endpoint convention, own docstrings) so the marketing data file stays
  untouched. `core/views.py::services_booking` renders
  `booking/pages/service_booking.html`.
- **Templates** live flat under `templates/booking/{layouts,components,pages}/`,
  matching the existing flat `templates/{components,partials}/` convention —
  no per-app template namespacing is used anywhere in this project.
- **Own layout, not `base.html`**: `booking/layouts/booking_base.html` is a
  sibling to `templates/base.html`, not an extension of it — different
  navbar/footer entirely (this page has no footer at all; the app shell IS
  the chrome). It reuses the same no-flash theme-detection script as
  `base.html` (dark mode still applies here — same tokens, same domain) and
  the same vendor CDN set, **plus Choices.js** (new — for the sort/category
  `<select>`, the only select-enhancement library in the stack).
- **Own static bundles**, not appended to the marketing ones:
  `static/css/booking.css` (imports `variables.css` + `base.css` for tokens/
  reset only, then all app-shell/catalog-specific rules — follows the exact
  same theme-aware token rules documented in "Dark mode / theming" above) and
  `static/js/booking.js` (self-contained IIFE, same style as `main.js`/
  `animations.js`). `main.js` is *also* loaded on this page for the parts
  that genuinely are shared (Lenis smooth scroll, theme toggle, AOS
  bootstrap) — every other main.js function targets marketing-only elements
  (preloader, hero navbar/drawer, carousels, accordion, lead forms) and
  no-ops harmlessly here since those elements don't exist on this page.
- **Search lives in the catalog content, not the navbar** (changed
  2026-07-30 — it was briefly navbar-inline on desktop + an icon-triggered
  overlay on mobile; the mobile version had no visible entry point at all
  in an earlier pass, then a toggle icon, before landing here). `search_bar.html`
  is included once in `catalog_grid.html` inside `.catalog__search`, directly
  above the sort bar, and stays visible at every breakpoint — no mobile-only
  toggle/JS needed. If a future change moves it back into the navbar, remove
  `.catalog__search` and re-add `margin-left: auto` removal from
  `.app-navbar__actions` (added specifically to fill the gap search used to
  occupy).
- **Mobile filter sidebar has two entry points on purpose**: the bottom
  nav's "Categories" icon (original, still works) and a "Filters" button
  in `sort_bar.html`, mobile-only (`.sort-bar__filter-btn`, hidden on
  desktop since the sidebar's already permanently visible there). Both
  carry `[data-filters-toggle]` and open the same `#filter-sidebar` panel —
  `initMobileFilters()` in `booking.js` uses `querySelectorAll` (not
  `querySelector`) specifically so any number of toggles stay in sync; if
  a third entry point is ever added, it only needs the same attribute, no
  JS changes. The redundancy is deliberate — "Categories" alone undersold
  what's actually behind it (price/rating/duration/etc., not just
  categories), so the sort-bar button is the more discoverable one.
- **Unified catalog**: single services and packages are one list —
  `get_booking_catalog()` — each item tagged `kind: 'service' | 'package'`,
  so filter/sort/search/cart/wishlist all treat every item generically.
  `discount_pct` and `duration_label` are derived server-side (not hand-
  entered) from `price`/`mrp`/`duration_mins` to avoid drift. The catalog is
  embedded once as JSON via Django's `json_script` filter
  (`{{ booking_catalog|json_script:"catalog-data" }}` in `catalog_grid.html`)
  — `booking.js` parses it once (`getCatalog()`, memoized) as the single
  source of truth for filtering/sorting/search/quick-view/cart rendering;
  server-rendered `.catalog-card` DOM nodes are then just reordered/hidden
  in place, never re-rendered from a JS template.
- **State**: cart (`glamour_cart`), wishlist (`glamour_wishlist`), and
  recent searches (`glamour_recent_searches`) persist to `localStorage` —
  proven pattern already used for the theme toggle. There's no backend/auth
  yet, so this is the correct place for it until Phase 2/3.
- **"Coming soon" stubs**: any nav/menu destination not built in this phase
  (Bookings, Wishlist page, Addresses, Notification Settings, Support,
  Logout, "Proceed to Booking") carries `data-coming-soon="<Feature name>"`;
  a single delegated handler in `booking.js` shows a toast instead of a dead
  link. Grep `data-coming-soon` to find every Phase 2/3 hookup point.
- **Static image reuse**: Phase 1 has no new photography — the catalog
  reuses the marketing site's existing `static/images/service-*.jpg` and
  `portfolio-*.jpg` files (see `core/booking_data.py`), which is why some
  package/service photos are thematically approximate rather than exact.
  Swap for real catalog photography alongside the other marketing
  placeholders noted above.

### Booking drawer (Phase 2) — architecture

- **Files**: `templates/booking/components/booking_drawer.html` (right-side
  slide-in panel, same slide-in mechanics as the marketing `mobile-drawer`)
  plus `static/js/booking_drawer.js` (own file, not folded into `booking.js`
  — "catalog browsing" and "booking flow" stay separate concerns, same
  rationale as the existing `main.js` vs `animations.js` split).
- **Shared surface**: `booking.js` exposes `window.GlamourBooking = { getCart, saveCart, getCatalog, formatCurrency, showToast, getAppliedDiscountRate }` at the end of its `DOMContentLoaded` handler.
  `booking_drawer.js` reads/clears the cart and reads the mini-cart's
  applied-coupon discount rate through this instead of duplicating cart
  logic. `saveCart()` dispatches a `glamour:cart-changed` window event
  rather than calling the mini-cart's render function directly — that's
  what keeps the mini-cart panel in sync when `booking_drawer.js` clears
  the cart on confirm, without either file needing to know the other's
  internals. `main.js`/`booking.js`/`booking_drawer.js` are all `defer`red
  in that order, so `GlamourBooking` is guaranteed to exist by the time
  `booking_drawer.js`'s own `DOMContentLoaded` handler runs (listeners for
  the same event fire in registration order, and registration order
  follows script/source order).
- **No beautician selection anywhere** — carried over from the original
  spec; don't add it even as a "nice to have".
- **Addresses**: `glamour_addresses` in `localStorage` (own key, separate
  from cart/wishlist), each `{id, label, text, pincode, lat, lng}`. `lat`/
  `lng` come from a map click, which also triggers a reverse-geocode to
  prefill the address/pincode fields (added 2026-08-06 — see
  `reverseGeocodePin()` in `booking_drawer.js`); both stay fully editable
  since a geocode match can be wrong or missing. A "📍 Use My Current
  Location" button (same date) calls the browser's `navigator.geolocation`
  API, pans the map + drops the pin at the returned coordinates, then
  reuses the exact same `reverseGeocodePin()` call — no separate code path.
  Fails silently to a toast ("please drop a pin manually") on denied
  permission or an unsupported browser; never blocks the form.
  - **Two interchangeable map backends** (added 2026-08-06), switched by
    `settings.USE_GOOGLE_MAPS_FOR_ADDRESS` (an env var, off by default):
    free/keyless Leaflet + OpenStreetMap + Nominatim (`initLeafletMap()` /
    `reverseGeocodeNominatim()`), or the Google Maps JS API + Geocoder
    (`initGoogleMap()` / `reverseGeocodeGoogle()`) once a real
    `GOOGLE_MAPS_API_KEY` is set. **A key alone is not enough** — Google
    Maps Platform also requires billing enabled on the Cloud project (a
    card on file, even to stay within the free monthly credit), or every
    call fails with `REQUEST_DENIED` / "This page can't load Google Maps
    correctly." Confirmed live: the key currently in `.env` loads the JS
    API fine but the Geocoder returns `REQUEST_DENIED` — billing isn't
    enabled yet. Both implementations are kept in the codebase
    permanently, regardless of which is active — flipping the flag in
    `.env` is the only step needed once billing is sorted, no code
    changes. `booking_base.html` conditionally loads Leaflet's CSS/JS vs.
    the Google Maps script tag based on the same flag (exposed to
    templates via `core/context_processors.py`).
- **Calendar**: hand-rolled month-grid (`renderCalendar()` in
  `booking_drawer.js`), not a library — consistent with this project's
  "no dependency for something easily hand-built" pattern (the FAQ
  accordion and before/after slider are the same story). Past dates are
  disabled; no maximum-future-date cap exists yet.
- **Step validation**: `validateStep(n)` gates the Next button reactively
  (disabled until each step's required selection is made) — see
  `updateNextButtonState()`. Step 4 (payment) requires
  `state.paymentConfirmed`, which is set immediately for "Pay At Home" but
  only after the simulated "Pay Now" processing delay resolves.
- **Progress persistence**: closing the drawer via the × button or backdrop
  does **not** reset in-progress selections — reopening resumes at the last
  active step. State only resets after a completed booking ("Done") or if
  the cart becomes empty while the drawer is closed (stale item references
  would otherwise dangle). This was a deliberate UX choice, not an oversight
  — revisit only if it reads as confusing in practice.
- **Confirmation**: a mock booking ID (`GAH######`) is generated
  client-side (`Math.random()`), the cart is cleared via
  `GlamourBooking.saveCart([])`, and no booking record persists anywhere
  (no backend yet) — closing/reloading loses it. This is the same
  "no-backend mock" scope boundary as everything else in Phase 1/2.

### `.env` (Google Maps / Razorpay — reserved, not currently used)

`requirements.txt` includes `python-decouple`; `GlamourAtHome/settings.py`
reads `GOOGLE_MAPS_API_KEY` / `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` via
`config(..., default='')` — safe empty defaults, **nothing consumes them**.
`.env.example` documents the exact variable names; `.env` is already
gitignored.

**Important**: Phase 2 (the booking drawer) is already built and works
without these — the address step uses free/keyless Leaflet + OpenStreetMap,
and payment is a simulated checkout. This was an explicit user decision
("still i will not provide API keys for map and razorpay"), not a blocker
that stalled the work. Do **not** assume adding real keys is required to
finish Phase 2 — it's already finished. If real Google Maps / Razorpay
integration is wanted later, that's a distinct, separately-scoped upgrade:
swap Leaflet's tile layer + pin-drop for the Google Maps JS API in
`booking_drawer.js::initMap()`, and replace the `[data-pay-now-simulate]`
click handler's `setTimeout` with a real Razorpay Checkout.js call — both
are isolated enough to swap without touching the rest of the drawer.

### A CSS gotcha worth knowing before touching `booking.css`

Several components toggle visibility with the plain `hidden` HTML attribute
(cart rows, search-panel sections, empty states) while also being styled
with an authored `display: flex/grid` rule for when they ARE visible. An
authored `display` rule beats the browser's built-in `[hidden] { display: none }` at equal specificity (author styles always win over the UA
stylesheet), which silently makes `el.hidden = true` do nothing — this was a
real bug (the cart's "Discount" row stayed visible showing "-₹0" even when
no coupon was applied). Fixed with a blanket `[hidden] { display: none !important; }`
near the top of `booking.css`. If a new toggled-via-`hidden` element doesn't
disappear as expected, this is almost certainly why — don't add a competing
`display` override, rely on the attribute.

### `position: sticky` silently didn't work anywhere on this page until 2026-07-30

`.filter-sidebar` (Phase 1) and `.catalog__toolbar` (search + result count +
Filters/Sort, added 2026-07-30) both use `position: sticky` — neither
actually stuck on scroll; both just scrolled away with the page, and this
went unnoticed through all of Phase 1/2 because every prior CDP check only
captured a screenshot at the top of the page, never after scrolling.

**Root cause**: `base.css` (shared with the marketing site) sets
`body { overflow-x: hidden; }`. Per the CSS spec, when one axis's overflow
is non-`visible` and the other is left `visible` (the default), the
`visible` one computes to `auto` instead — so `body` silently became
`overflow-x: hidden; overflow-y: auto`, which changes body into an
overflow-participating box and breaks `position: sticky` for its
descendants (a well-documented CSS gotcha, not a Lenis issue — verified via
CDP that Lenis wasn't touching any transforms/overflow here).

**Fix**: `body.booking-app` in `booking.css` sets `overflow-x: clip;`
instead of relying on the inherited `hidden` — `clip` hides the same
horizontal overflow without triggering the visible→auto conversion. Scoped
to the booking app only (didn't touch `base.css`, so the marketing site —
which has no sticky elements, just `position: fixed` — is unaffected).

**Lesson for future CDP verification passes on this page**: always check
element position/rect *after* scrolling, not just at the initial viewport —
a screenshot at scroll-position-zero cannot catch a broken `position: sticky`, since sticky and static/relative look identical until you scroll
past the element's natural position.

### Two more real bugs found via CDP click-tracing while building Phase 2

- **Never reuse a `components.css` class name for a new booking-app
  element, even one that "sounds generic".** The booking drawer's backdrop
  was originally classed `drawer-backdrop drawer-backdrop--booking`,
  intending `--booking` as a modifier — but `.drawer-backdrop` already
  exists in `components.css` for the marketing mobile-nav drawer, with
  `z-index: 999990 !important`. That `!important` silently won over this
  element's intended `z-index: calc(var(--z-drawer) - 1)`, making the
  backdrop render *above* the drawer's own content — clicks meant for the
  Leaflet map inside the drawer were actually landing on the backdrop
  behind it (confirmed by dispatching a synthetic click and checking
  `document.elementFromPoint()` before/after: it resolved to the backdrop
  div, not the map). Renamed to the standalone `.booking-drawer-backdrop`
  (no shared base class with the marketing drawer at all) to fix. Before
  giving a new booking-app element a name that overlaps with an existing
  marketing class, grep `components.css`/`sections.css` for it first.
- **A `saveCart([])` call inside your own confirmation flow can trigger
  your own "cart emptied externally" safety net and undo itself.**
  `confirmBooking()` clears the cart via `GlamourBooking.saveCart([])`,
  which dispatches `glamour:cart-changed` *synchronously* — the same event
  `booking_drawer.js` listens for elsewhere to detect the cart being
  emptied *outside* the drawer (e.g. from the mini-cart while the drawer is
  closed) and reset stale state. Without a guard, that listener fired
  immediately after `confirmBooking()` set up the confirmation screen,
  treated it as an external clear, and called `resetState()` — silently
  swapping the confirmation screen back to step 1 in the same tick (only
  caught because the CDP screenshot right after "confirm" showed step 1
  instead of the confirmation UI). Fixed with a `justConfirmed` flag set
  before `saveCart([])` in `confirmBooking()` and checked (and cleared) in
  the listener/`resetState()` — see `booking_drawer.js`. The general lesson:
  when two independent pieces of code react to the same shared event,
  double-check that one's own action doesn't re-trigger the other's
  "something changed unexpectedly" logic.

## Authentication (added 2026-07-30)

Built before Phase 3 (chat/notifications backend/wishlist page/bookings
dashboard are meaningfully more useful once tied to a real logged-in user).
Login, signup, logout, and password reset are fully functional now; Google
and Apple sign-in buttons render but won't complete a real login until real
credentials are dropped into `.env` — same "scaffold now, wire later"
pattern as `GOOGLE_MAPS_API_KEY`/`RAZORPAY_KEY_ID` in the booking app.

- **Library: `django-allauth[socialaccount]`** (note the extra — plain
  `django-allauth` doesn't pull in `requests`/`PyJWT`/`oauthlib`, which the
  Google/Apple providers need; installing without it crashes at startup with
  `ModuleNotFoundError`). `requests` is consequently now a **real, permanent
  project dependency** — unlike earlier phases, don't uninstall it after a
  CDP testing session; only `websocket-client` is test-only.
- **No custom User model.** allauth's `ACCOUNT_LOGIN_METHODS = {'username', 'email'}` +
  `ACCOUNT_SIGNUP_FIELDS = ['email*', 'password1*', 'password2*']` allow users to log in entering either their username or email address on top of Django's default `auth.User` — no
  `AUTH_USER_MODEL` swap needed (which would've been painful *after*
  migrations exist, but was never necessary here at all).
- **Redesigned Sign In page (`templates/account/login.html`)**:
  Custom luxury sign-in page template created to override default allauth layout. Features a dark card container (`border-radius: 32px`), clean full-width input fields (`auth-input`) for Username/Email (`Username or email address` placeholder) and Password, Forgot your password link, Remember Me checkbox, full-width gold gradient action button (`.auth-submit-btn`), third-party section divider, and centered pill-shaped social sign-in buttons with inline Apple and Google icons (`.auth-social-btn`).
- **No custom adapter needed either.** allauth's `get_login_redirect_url()`/
  `get_logout_redirect_url()` fall back to Django's own standard
  `LOGIN_REDIRECT_URL`/`LOGOUT_REDIRECT_URL` settings (both point at
  `/services-booking/`) — a project-specific `AccountAdapter` subclass was
  planned but turned out to be unnecessary; the `accounts` app exists purely
  as a placeholder for future account-specific model/signal work.
- **Credentials via `SOCIALACCOUNT_PROVIDERS`** (settings dict reading
  `.env` through the existing `python-decouple` pattern), not
  database-managed `SocialApp` records. `.env.example` has
  `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET` and
  `APPLE_OAUTH_CLIENT_ID`/`_TEAM_ID`/`_KEY_ID`/`_PRIVATE_KEY` (Services ID/
  Team ID/Key ID/the `.p8` file's contents respectively). Apple's
  `certificate_key` is nested under `APP['settings']` in
  `SOCIALACCOUNT_PROVIDERS`, not top-level in `APP` — the top-level spot
  still works but logs a deprecation warning.
- **Password reset emails use the console backend** (`EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'`) — reset links print to
  the `runserver` terminal instead of sending. Swap `EMAIL_BACKEND` (+ add
  SMTP host/port/credentials settings) for real delivery; no template/view
  changes needed.
- **Templates override allauth's `{% element %}` partials for generic pages & custom `account/login.html` for sign-in.** allauth 65.x renders account pages through small reusable template partials (`allauth/elements/*`). We override `templates/allauth/layouts/base.html` (the page shell — logo, centered `.auth-card`, no navbar/footer), `templates/allauth/elements/`, and explicitly `templates/account/login.html` for the bespoke Sign In design.
- **`static/css/auth.css`** is its own bundle (imports `variables.css` +
  `base.css` + `components.css` directly, not `main.css`) — updated with luxury dark card styling, gold accent buttons, custom input focus states, and explicit flex-row inline SVG button styling for Apple & Google third-party social logins.
- **Profile dropdown is now real**: `templates/booking/components/ profile_dropdown.html` branches on `user.is_authenticated` (available
  everywhere via the existing `django.contrib.auth.context_processors.auth`
  context processor — no view changes needed). Signed out → Sign In/Create
  Account links with the current page as `?next=`. Signed in → real email +
  a working Logout (POSTs to `account_logout`). Profile/Bookings/Wishlist/
  Addresses/Notification Settings/Support stay `data-coming-soon` — still
  Phase 3 territory. `app_navbar.html`'s avatar shows the user's email
  initial when authenticated, a generic person icon when not.
- **This is the project's first real migration.** `python manage.py makemigrations && migrate` has now actually been run (previously only
  Django's framework-default tables existed, unapplied). The default
  `django.contrib.sites` Site record was updated from `example.com` to
  `glamourathome.com`/`SITE_NAME` — if `db.sqlite3` is ever recreated from
  scratch, redo that (`Site.objects.get(pk=1)`, set `domain`/`name`) or
  allauth's emails will show `example.com` in links.

## Catalog & Bookings models (added 2026-07-31)

The booking catalog and the booking drawer's "Confirm Booking" step are no
longer mock — two new apps, `catalog` and `bookings`, back them with real
models and the project's second/third real migration sets (after
Authentication). Marketing (`mock_data.py`) is untouched.

- **`catalog` app** — `Category` (slug/name/icon, same shape the mock
  categories always had), `Service` (the conceptual offering — slug, name,
  category FK, kind `service`/`package`, description, photo, tone, rating,
  reviews_count, popularity_score, badges JSONField, available_today,
  is_active), `ServiceVariant` (the actual priced/bookable SKU — service FK,
  label, duration_mins, price, mrp, is_default, is_active, sort_order).
  **Why the split**: a `Service` can have multiple price/duration
  combinations (e.g. "60 min" vs "90 min" facial) without duplicating name/
  description/category per price point — `Service.default_variant` picks
  which one a catalog card shows. **Only one variant per service is seeded
  today** (`is_default=True`) — no variant-picker UI exists yet; that's a
  distinct future task, not implied by this schema existing.
- **`Service.slug` = the pre-existing mock catalog ids, unchanged**
  (`hair-spa`, `essential`, etc.) — **this is now a real, grep-able
  cross-file contract**: marketing `mock_data.py`'s service/package `id`
  fields must keep matching these slugs, or the marketing "Book Now"/
  "Choose `<package>`" → booking-cart handoff (see "Marketing → Booking
  cart handoff" above) silently breaks — a cart entry would reference a
  slug with no matching `Service`. Don't rename a `Service.slug` without
  updating `mock_data.py`'s matching id in the same change.
- **`core/booking_data.py::get_booking_categories()`/`get_booking_catalog()`
  kept their exact names and exact return shape** (list of dicts, same
  keys as always) — only their *implementation* changed, from hardcoded
  lists to ORM queries shaped into the same dicts.
  `core/views.py::services_booking` needed **zero changes**; neither did
  any template or `booking.js`/`booking_drawer.js` filter/sort/cart logic.
  `get_booking_catalog()` explicitly orders by `id` (creation order), not
  `Service.Meta.ordering` (`-popularity_score`) — `booking.js`'s "Newest"
  sort assumes the embedded catalog array reflects chronological order and
  reverses it; sorting by popularity here would silently break that option.
  `discount_pct`/`duration_label` are `ServiceVariant` properties (derived,
  not stored), same anti-drift principle the mock version used.
  **Decimal → float gotcha**: `price`/`mrp`/`rating` are explicitly cast to
  `float()` before they reach the dict — `json_script` (how this data
  reaches `booking.js`, via `{{ booking_catalog|json_script:"catalog-data" }}`
  in `catalog_grid.html`) serializes `Decimal` through `DjangoJSONEncoder`
  as a *string*; left as Decimal, `item.price * qty` in JS would silently
  become string concatenation instead of multiplication.
  `get_booking_offers()`/`get_notifications_mock()`/`get_trending_searches()`
  remain genuine mock data — not asked to become models yet.
- **`catalog/migrations/0002_seed_catalog.py`** is a data migration seeding
  the 6 categories + 12 services/variants with the exact values the old
  mock functions hardcoded — `python manage.py migrate` reproduces the
  full catalog from scratch, no separate fixture-loading step.
- **`bookings` app** — `Booking` (booking_number unique/auto-generated with
  a collision-check loop — same `GAH######` shape the old client-side mock
  id used, user FK, **snapshotted** address fields — not just an FK to a
  saved address, so a booking stays accurate if the address is later
  edited/deleted — scheduled_date, booking_type/time_slot/exact_time,
  payment_method/payment_status, **snapshotted** subtotal/discount_amount/
  total_amount, coupon_code, status), `BookingItem` (booking FK,
  service_variant FK nullable-on-delete, **snapshotted** name/price/
  duration, quantity). Both apps' admin registrations include inlines
  (`ServiceVariant` under `Service`, `BookingItem` under `Booking`).
- **`POST /services-booking/book/`** (`bookings/views.py::create_booking`,
  `bookings/urls.py` included at root) — **recomputes subtotal/discount/
  total server-side from real `ServiceVariant` prices, never trusts
  client-sent totals** (a stale cart or tampered request must not be able
  to under/overcharge). Coupon rates (`GLAM10`/`WEEKDAY15`/`BUNDLE20`) are
  duplicated in a small Python dict (`COUPON_RATES`) matching `booking.js`'s
  `COUPONS` — an accepted, small-drift-risk tradeoff rather than building a
  shared coupon API for three hardcoded codes; if a code is ever added/
  changed, update both places. Returns JSON (`{ok, booking_number}` or
  `{ok: false, error}`) rather than redirecting on auth failure — a
  redirect response can't be handled by `fetch()` the way an HTML page load
  can, and this is called from JS, not a form submission.
- **Booking creation requires login; browsing/cart do not.** Gated in
  `booking_drawer.js` at the `[data-proceed-to-booking]` click — **before**
  the drawer opens, not buried at the final Confirm step (filling all 5
  steps only to be told "please sign in" would be a worse experience). An
  anonymous user with cart items gets redirected to `account_login` with
  `?next=` back to the booking page; the cart (`localStorage`) survives the
  redirect since it isn't tied to the session.
  `window.body.dataset.authenticated`/`data-login-url` are set in
  `booking_base.html` from `request.user`/`{% url 'account_login' %}`.
  `create_booking` itself also re-checks `request.user.is_authenticated`
  (session could expire mid-flow) rather than relying solely on the
  JS-level gate.
- **`getCsrfToken()`** in `booking_drawer.js` reads the `csrftoken` cookie
  Django's CSRF middleware already sets — Django's standard AJAX CSRF
  pattern, sent back as the `X-CSRFToken` header on the `fetch()` POST.
- **`GlamourBooking.getAppliedCouponCode()`** was added to `booking.js`'s
  shared export (alongside the existing `getAppliedDiscountRate()`) so
  `confirmBooking()` can send the actual coupon *code* string to the server
  for it to re-validate/re-apply, not just the numeric rate.

## Real catalog data (added 2026-08-01)

The client's actual price list started arriving and replaced the fictional
demo catalog (`catalog/migrations/0004_replace_demo_with_real_catalog.py`).
**More real data batches are expected** — this is the first, not the last.

- **Removed**: the 9 demo single-services + their 5 categories (hair, skin,
  makeup, nails, spa — `hair-spa`, `glow-facial`, `bridal-makeup`,
  `gel-manicure`, `thai-massage`, `keratin-smoothing`, `threading-brows`,
  `classic-pedicure`, `head-shoulder-massage`).
- **Kept, deliberately**: the `package` category + its 3 demo services
  (`essential`/`signature`/`indulgence`). None of the real data received so
  far includes any package/bundle service — per explicit user decision, the
  demo packages stay until real package data exists, so the marketing
  homepage's "Packages" section isn't left empty. **When real package data
  arrives, replace these three specifically** (they're the one remaining
  piece of fictional content).
- **Added**: 6 new categories (Threading, Peel-Off Wax, Body Wax, Bikini
  Wax, Basic Facial, Premium Facial), 38 services, 68 variants total.
- **Body Wax and Bikini Wax are this catalog's first genuine multi-variant
  services** — e.g. `body-wax-full-arms` has 5 variants (Honey/Chocolate/
  Rica Wax, Chocolate/Rica Roll-On) at 5 different prices, exactly the case
  `ServiceVariant` was built for (see "Catalog & Bookings models" above).
  Only the cheapest (Honey Wax) is `is_default=True` and shows on the
  catalog card — **there is still no variant-picker UI**, so a customer
  currently can't choose Chocolate/Rica/Roll-On from the storefront even
  though the data exists and is admin-editable. This is now a real, not
  theoretical, gap — worth prioritizing if/when a multi-variant service
  actually needs to sell its non-default variants.
- **Fields NOT provided by the client, so estimated/defaulted** — check
  these in admin and correct as real numbers become available:
  - `duration_mins` for every Threading/Peel-Off Wax/Body Wax/Bikini Wax
    service — the client's price list had no duration column for these.
    Basic/Premium Facial durations ARE client-provided (exact).
  - `photo`/`tone` — placeholder stock images reused from the existing
    marketing photo set (see `PHOTOS`/`TONES` dicts in the migration),
    **not real photos of this client's actual work**. Same "replace before
    launch" status as every other placeholder in this file.
  - `rating`/`reviews_count`/`popularity_score` — all `0`, not fabricated.
    `catalog_card.html` and `templates/booking/components/ quick_view_modal.html`'s JS (`initQuickView()` in `booking.js`) both
    hide the ★ rating badge entirely when `reviews_count` is falsy, instead
    of showing "★0.0 (0)" on every real service. `featured_services.html`
    (marketing) does the same, gated on `service.rating` being falsy (that
    mock shape has no separate reviews_count field).
- **Marketing homepage's Featured Services** (`mock_data.py:: get_featured_services()`) were replaced with 6 real services spanning the
  new categories (one threading, two waxing, two facial, one premium
  bridal facial) — ids match the corresponding `catalog.Service.slug`
  exactly, preserving the "Book Now" → booking-cart handoff contract.
  `get_service_categories()` (the marketing page's filter chips) was
  simplified to `['All', 'Threading', 'Waxing', 'Facial']` — this is a
  client-side-only convenience chip set, not required to mirror
  `catalog.Category` slugs 1:1.
- **Migration reversibility is partial by design**: `0004`'s reverse
  function removes what it added but does **not** resurrect the deleted
  demo services/categories — re-run migration `0002`'s logic by hand if the
  demo catalog is ever needed again (unlikely, but noted in the migration's
  own docstring too).

## Bookings dashboard (added 2026-08-01)

`/services-booking/bookings/` — Phase 3's first real piece (see "Service
Booking App" above). `bookings/views.py::bookings_dashboard`, gated with
`@login_required` (Django's decorator handles the redirect-to-login-with-
`?next=` itself — no custom logic needed, same as everywhere else auth is
enforced in this project).

- **Lists the signed-in user's own bookings only** (`request.user.bookings`,
  the reverse FK from `Booking.user`), newest first (`Booking.Meta.ordering`).
  Status tabs (All/Upcoming/Completed/Cancelled) are plain client-side class
  toggling (`bookings_dashboard.js::initBookingTabs()`) over the
  server-rendered cards — same `is-hidden` pattern the catalog's own filters
  use — since a user's own booking list is never large enough to need
  pagination or a server round-trip per tab.
- **"Rebook"** re-adds a past booking's items to the cart entirely
  client-side — no new backend endpoint. Each booking's rebookable items
  (only ones whose `ServiceVariant`/`Service` are still `is_active` — a
  booking can reference a since-deactivated variant via
  `BookingItem.service_variant`'s `on_delete=SET_NULL`) are precomputed in
  the view as `booking.rebook_items` and serialized per-booking via
  `{{ booking.rebook_items|json_script:booking.booking_number }}` (the
  filter's second argument can be a template variable, not just a string
  literal — that's what makes one `json_script` tag per booking, keyed by
  its own `booking_number`, work without a custom template filter). Clicking
  "Rebook" reads that JSON and merges it into the cart via
  `window.GlamourBooking.getCart()`/`saveCart()` — the exact same shared
  surface `booking_drawer.js` already depends on, so the floating cart's
  mini-panel and badge count update immediately (`saveCart()` dispatches
  `glamour:cart-changed`, which the cart panel already listens for).
- **Reuses `get_booking_catalog()`/`get_booking_categories()`/
  `get_booking_offers()`/`get_notifications_mock()`** — same context shape
  `core/views.py::services_booking` passes — because this page also
  includes `app_navbar.html`, `floating_cart.html`, and `chat_panel.html`
  for shell consistency, and those all expect that context (Categories/
  Offers dropdowns, the notification badge dot). This is also *why* the
  floating cart actually works on this page: `getCatalog()` in `booking.js`
  degrades to an empty array (not an error) when `#catalog-data` is
  missing from the page, which would otherwise make the mini-cart panel
  silently render zero lines even with real items in `localStorage`.
  `quick_view_modal.html` is deliberately **not** included here — nothing
  on this page triggers it.
- **Cancel booking** (added 2026-08-01, right after the dashboard itself):
  the one status transition a *user* can trigger — `POST /services-booking/bookings/<booking_number>/cancel/`
  (`bookings/views.py::cancel_booking`), a plain server-rendered
  `<form method="post">` per booking, not a fetch/AJAX call — the resulting
  page reload is exactly what's needed to move the booking to a new tab and
  show its updated status badge, so there's no reason to build a JSON
  round-trip for this.
  - **Rule: only `status == 'upcoming'` AND more than 3 hours before its
    `scheduled_start`.** `Booking.scheduled_start` (a new property) turns
    `scheduled_date` + `time_slot`/`exact_time` into one concrete datetime —
    a *regular* booking only ever stored a time_slot (a window, e.g.
    "Morning (8 AM – 12 PM)"), not a moment, so `SLOT_START_TIMES` maps each
    slot to its own start time; an *urgent* booking already has a real
    `exact_time`. `Booking.can_cancel` (also a property) does the actual
    `timezone.now() <= scheduled_start - CANCELLATION_CUTOFF` check —
    `CANCELLATION_CUTOFF = timedelta(hours=3)`, both module-level in
    `bookings/models.py` so the exact same rule can't drift between the
    template (which only *renders* the Cancel button when `can_cancel` is
    true) and the view (which re-checks `can_cancel` again server-side,
    since a tab left open past the cutoff would otherwise still submit a
    now-stale button).
  - **No `USE_TZ`/`timezone.make_aware()` needed** — this project runs
    `USE_TZ = False` (see settings.py), so `timezone.now()` and
    `datetime.combine(...)` are both already-naive and directly comparable.
  - **Cross-user protection**: `get_object_or_404(Booking, booking_number=..., user=request.user)` — a booking_number belonging to
    someone else 404s (not 403s), so the endpoint never confirms or denies
    whether a given booking_number exists at all.
  - **Feedback via `django.contrib.messages`**, rendered as simple
    `<p class="bookings-dashboard__message--{{ message.tags }}">` — the
    first real use of the messages framework outside `allauth`'s own pages
    in this project (MessageMiddleware was already in `MIDDLEWARE`, so no
    settings changes needed).
  - **A booking that's upcoming but past the 3h cutoff** shows a plain note
    ("Can't be cancelled — starts within 3 hours") instead of Rebook or
    Cancel — Rebook itself is now also correctly scoped to non-`'upcoming'`
    bookings only (it computed for every booking regardless of status
    before this; rebooking something that hasn't happened yet never made
    sense).
  - **Still no automatic `'completed'` transition** — nothing marks a
    booking completed after its date passes; that remains a gap (would need
    a scheduled task/cron, out of scope here).
- **"Bookings" nav links** (`bottom_nav.html`, `profile_dropdown.html`) were
  `data-coming-soon` stubs before this — now real `<a href="{% url 'bookings_dashboard' %}">` links. Grep `data-coming-soon` for what's still
  stubbed (Notification Settings, Support — Profile/Addresses stopped being
  stubs too, right after this; see "Profile & saved addresses" below).

## Profile & saved addresses (added 2026-08-01)

New `accounts` app models — `accounts/models.py` — this project's User is
still plain `auth.User` (never swapped to a custom model; way too late in
the project for that to be a safe change now), extended the standard way:

- **`Profile`** — `OneToOneField` to `User`, holding the one field
  `auth.User` doesn't have that the account page needs: `phone`.
  `first_name`/`last_name`/`email` are edited/read directly off `User`
  itself. `Profile.objects.get_or_create(user=request.user)` in
  `profile_view` means no signal is needed to create one at signup time —
  it's created lazily the first time anyone visits the page.
- **`Address`** — `ForeignKey` to `User`, `{label, text, pincode, lat, lng}`
  — the *exact* shape the booking drawer's address step already used when
  it was `localStorage`-backed (`glamour_addresses`). **Not** the same
  thing as `Booking`'s own `address_*` fields — those stay a frozen
  snapshot taken at booking time (see "Catalog & Bookings models"); `Address`
  rows are the *reusable, editable* source those snapshots get copied from.

**`/services-booking/profile/`** (`accounts/views.py::profile_view`) — one
page, two sections:

- **Account details**: a plain form POST (not fetch) updating
  first/last name + phone, `django.contrib.messages` for the "Profile
  updated." feedback (same `{{ message.tags }}`-keyed CSS classes pattern
  `bookings_dashboard.html` already established for Cancel Booking's
  messages — kept as a separate `.profile-page__message` class rather than
  reusing `.bookings-dashboard__message` outright, since the two pages
  don't share a base template section worth factoring out yet for just
  this).
- **Saved addresses**: list + delete + a plain (no map) add-address form.
  Deliberately **no Leaflet map here** — that interactive pin-drop UI stays
  exclusive to the booking drawer's own address step; the profile page's
  add-form only takes label/text/pincode, leaving `lat`/`lng` `null` (both
  already nullable on `Address` — nothing downstream requires them).

**Why the booking drawer needed a real rewrite, not just a new page**: the
address step's `getAddresses()`/`saveAddresses()` were pure `localStorage`
reads/writes (`ADDRESS_KEY = 'glamour_addresses'`) — meaning addresses
never left the browser they were created in, and the new profile page's
address list would've been a *second, disconnected* set of addresses
otherwise. Fixed in `booking_drawer.js`:

- `addressCache` (a plain array, populated by `fetchAddresses()` hitting
  `GET /services-booking/addresses/`) replaces `localStorage.getItem(...)`
  — `getAddresses()` now just returns that cache synchronously, so
  `renderSummary()`/`confirmBooking()`/`validateStep()` (all synchronous,
  called many times per flow) needed zero changes beyond that one function
  swap. `fetchAddresses()` re-runs every time `openDrawer()` runs, not just
  once at page load, so an address added/deleted on the profile page (or
  earlier in the same session) is never stale by the next booking.
- **id type changed from string to number** — the old client-generated ids
  were `` `addr-${Date.now()}` `` strings; real Django PKs are numbers.
  `state.addressId = card.dataset.addressId` (a DOM dataset value, always a
  string) would silently never `===`-match `addr.id` (a number) again
  without `Number(...)` — fixed at the one place that reads it off the DOM
  (`renderAddressList()`'s click handler); every other comparison already
  worked once that single value was the right type.
- "Save Address" is now `async`, `POST`s to the same
  `/services-booking/addresses/` endpoint (`X-CSRFToken` header, Django's
  standard AJAX CSRF pattern — same as `confirmBooking()`), and pushes the
  server's returned address (with its real id) into `addressCache` on
  success instead of constructing one locally.
- **No delete from inside the drawer** — deliberately out of scope there
  (it's mid-booking-flow, not the place for it); deletion lives on the
  profile page only. `address_delete` (`accounts/views.py`) still uses the
  same `get_object_or_404(Address, id=..., user=request.user)` ownership
  check pattern as `bookings/views.py::cancel_booking` — a 404, not a 403,
  for someone else's address id.

## Current state vs. future work (explicitly out of scope this phase)

- Marketing site: no payment integration — by design (see project goal at
  the top of this file). Auth now exists project-wide (see "Authentication"
  above) but the marketing site itself has no login UI — only the booking
  app's profile dropdown surfaces it.
- Booking app: Phase 1 and 2 done (see above); catalog + bookings now
  persist to real models too (see "Catalog & Bookings models"). No real
  Maps/Razorpay wiring (by choice, not a gap — Phase 2 works without them).
  Bookings dashboard UI now exists (see "Bookings dashboard" above) —
  still no real chat/notifications backend, and no status-transition logic
  (nothing yet marks a booking completed/cancelled automatically).
- Marketing site (`mock_data.py`) still has no models — only the booking
  app's catalog/bookings do (see "Catalog & Bookings models"). Don't
  migrate marketing content to models speculatively; do it when the
  marketing side actually needs admin-editable content too.
- Real catalog data is partway migrated (see "Real catalog data" above) —
  the demo `package` category/services are the one remaining piece of
  fictional content, kept only because no real package data exists yet.
  More real service batches are expected; each becomes its own data
  migration following `0004`'s pattern.
- No DRF app scaffolded yet (`djangorestframework` is commented out in
  `requirements.txt`) — uncomment and `pip install` when that work begins.

## Premium UI Upgrade — Navbar, Search, Filter & Sort (added 2026-07-29)

All visual and interaction upgrades stay within the existing design token
system (`variables.css`) and break zero existing JS hooks (`data-*`
attributes, `id`s, ARIA). Both the booking app's UI components and their
backing CSS were updated together; no template structure changes were needed
for the marketing navbar (it already had `backdrop-filter` on `.is-scrolled`).

### Booking app navbar (`app_navbar.html` + `booking.css`)

- **Frosted glass**: `background` is now `rgba(255,255,255,0.82)` +
  `backdrop-filter: blur(18px) saturate(180%)` — the navbar shows
  translucent page content beneath it instead of a flat opaque `--surface-2`.
  Dark-mode uses `rgba(36,30,25,0.82)`.
- **Scroll compression** (`initAppNavbarScroll()` in `booking.js`):
  `window.scrollY > 48` → `[data-scrolled]` attribute added to `#app-navbar`.
  CSS transitions `height` from `4.5rem → 3.75rem` and tightens the
  background opacity and shadow. Logo font-size also subtly reduces.
- **Nav link hover underlines**: `::after` pseudo-element with a gold gradient
  `scaleX(0 → 1)` on hover/`.is-active`.
- **Icon-button hover lift**: `color → --accent-gold`, `border-color → --gold`,
  `box-shadow` gold ring, `translateY(-1px)` — same premium affordance as the
  marketing site's card hovers.
- **Avatar gold ring glow**: `border: 2px solid transparent` → `border-color: --gold` + `box-shadow` ring on hover.
- **Notification badge pulse**: `badge-pulse` keyframe animation on
  `.app-navbar__badge-dot` — subtle glow pulse to draw attention.
- **Cart count pop**: `.app-navbar__cart-count.is-updated` runs a `cart-pop`
  scale keyframe whenever the cart is updated.

### Search bar (`search_bar.html` + `booking.css`)

- **Gold glow focus ring**: `box-shadow: 0 0 0 4px rgba(201,161,90,0.15)`
  on the input when focused — replaces the basic `border-color` change.
- **Icon morph on focus**: `.search-bar:focus-within .search-bar__icon`
  scales `1.1×` and shifts to `var(--gold-deep)`.
- **Slide-in panel**: `search-panel-in` keyframe (`opacity 0→1`,
  `translateY(-6px → 0)`) on the autosuggest panel appearance.
- **Result row slide**: `search-result:hover` translates `translateX(3px)`
  - shows a CSS chevron arrow `::after` pseudo-element.
- **Tag hover**: tag chips animate `border-color`, `color`, `background`
  on hover for interactive feedback.

### Sort bar (`sort_bar.html` + `booking.css` + `booking.js`)

- **Sort pills replace the native `<select>`**: six `<button data-sort-pill="…">` pill buttons (Most Popular | Newest | Price ↑ | Price
  ↓ | Top Rated | Duration) replace the old `<select id="sort-select">`.
  - The hidden `<select data-sort-select class="sr-only">` is preserved so
    `getFilterState()` continues reading `.value` unchanged — the
    `initSort()` click handler in `booking.js` syncs the pill's
    `dataset.sortPill` into it before dispatching `'change'`.
  - Choices.js is no longer initialized (the pill UI supersedes it); the
    guard is kept as a no-op comment so the CDN tag (if still present in
    the base template) doesn't error.
  - Active pill: `--gradient-gold` background + `box-shadow: 0 4px 14px rgba(169,127,55,0.3)` + `translateY(-1px)`.
  - On mobile (≤640px): `.sort-pills { flex-wrap: nowrap }` and
    `.sort-bar__controls { overflow-x: auto }` — pills scroll horizontally
    instead of wrapping.
- **Active filter count badge** (`data-filter-badge` in `sort_bar.html`):
  `updateFilterBadge()` in `booking.js` counts every non-default filter
  selection (type ≠ all, categories, price, duration, rating, offers,
  availability) and shows a gold `--gradient-gold` badge bubble on the mobile
  Filters button. The badge pops in with a `badge-pop` keyframe.

### Filter sidebar (`filter_sidebar.html` + `booking.css`)

- **SVG icons per group label**: each `filter-group__label` now has a
  `filter-group__label-inner` flex wrapper with an inline SVG icon (grid
  for Type, tag for Category, currency for Price, clock for Duration, star
  for Rating, checkbox for Extras) styled `color: var(--accent-gold)`.
- **Custom checkboxes** (`.filter-checkbox__box` + `.filter-checkbox__check`):
  native `<input type="checkbox">` hidden via `appearance: none`; a custom
  box `div` shows a gold-gradient fill + ink checkmark tick on `:checked`.
  A CSS fallback (`:not(:has(~ .filter-checkbox__box))`) keeps offer/
  availability toggles working if `.filter-checkbox__box` isn't present.
- **Premium range slider**: `appearance: none` on the `<input type="range">`;
  custom thumb (`--gradient-gold`, white border, gold shadow, scale on hover);
  custom track uses a CSS `linear-gradient` with `--range-pct` CSS variable
  that `booking.js` updates on every `input` event, giving a live gold-fill
  left of the thumb.
- **Filter group header**: mobile slide-in header now shows an italic Fraunces
  "Filters" heading + border-bottom.
- **Clear Filters button**: gold outline (`border-color: --gold`), trash SVG
  icon, subtle gold background on hover. When clicked, range `--range-pct`
  is also reset to `100%` alongside the value reset.
- **Backdrop blur**: `.filter-sidebar-backdrop` gains `backdrop-filter: blur(3px)` to subtly focus attention on the open sidebar.

## Admin / Owner Dashboard (added 2026-08-04)

A dedicated, high-end control panel at `/owner-dashboard/` for business owners to manage operations, catalog pricing, order lifecycle, and staff roster. Restricted to users with `@staff_member_required` (`is_staff=True`).

- **KPI Analytics Overview (`/owner-dashboard/`)**:
  - Displays 4 key metric cards: Total Revenue (sum of completed orders), Total Bookings, Active Services count, and Active Staff count.
  - Lifecycle Breakdown: Visual grid tracking Upcoming, In Progress, Completed, and Cancelled orders.
  - Recent Orders table with real-time status badges and customer info.
- **Order & Booking Management (`/owner-dashboard/bookings/`)**:
  - Filter by status tabs (`All`, `Upcoming`, `In Progress`, `Completed`, `Cancelled`), date, or text search across ID, customer email, name, and address.
  - Update order status and payment status in real-time.
  - Assign or reassign beauticians/employees to orders (`Booking.assigned_beautician`).
- **Service Catalog & Pricing (`/owner-dashboard/services/`)**:
  - Filter catalog by Category or search service names.
  - Full Service Editing: Edit service name, category, kind (service vs. package), description, and badges (`edit_service`).
  - Delete Service: Delete services permanently (`delete_service`).
  - Multi-Variant Service Creation: Add a new service with multiple initial variants dynamically in the creation modal (`add_service`).
  - Variant Management: Add new variants to existing services (`add_variant`), edit variant label/price/MRP/duration/default status (`update_variant_price`), and delete variants (`delete_variant`).
  - Toggle `is_active` state inline to enable/disable services from the customer catalog instantly.
- **Employee & Staff Roster (`/owner-dashboard/employees/`)**:
  - Backed by the `accounts.Employee` model (`name`, `phone`, `email`, `specialties`, `status`, `rating`, `experience_years`).
  - List staff with assigned order counts, specialties, and experience ratings.
  - Toggle employee availability (`active` vs. `on_leave`).
  - Add new beauticians and edit staff details via modal dialogs.
- **Styling & Mobile Navigation**: `static/css/admin_dashboard.css` provides a luxury control panel theme with dark sidebar navigation, gold accents, status pill badges, data table layouts, and glassmorphic modal dialogs. Features a dark/light mode toggle button (`.admin-theme-toggle`) in the topbar linked to `localStorage`, a responsive mobile hamburger toggle (`#adminMobileToggle`), drawer backdrop (`#adminSidebarBackdrop`), and topbar text truncation to prevent overflow on mobile screens.

## Employee / Beautician Dashboard (added 2026-08-04)

A dedicated, mobile-first job execution portal at `/emp-dashboard/` for field beauticians and staff to manage daily appointments and job lifecycles on smartphones.

- **Model Linking**: `accounts.Employee` model linked to Django `User` (`user = models.OneToOneField(settings.AUTH_USER_MODEL, ...)`).
- **Daily Appointments Schedule**: Highlights assigned bookings for the current date with time slot, customer phone call links (`tel:`), and Google Maps direction links (`maps:`).
- **Job Status Execution**: One-tap buttons to update job status (`Upcoming` $\rightarrow$ `In Progress` $\rightarrow$ `Completed`) and mark payments as `Paid`.
- **Duty Toggle**: Quick topbar switch (`On Duty` vs. `Off Duty`) updating availability in real-time.
- **Performance KPIs**: Tracks today's appointments, total completed jobs, customer rating score, and revenue earnings.
- **Styling & Theme**: `static/css/employee_dashboard.css` provides a mobile-first dark/light theme supporting `data-theme-toggle` and `localStorage`.

## Express Urgent Booking Feature (added 2026-08-05)

- **Automatic 50-Minute Calculation**: Selecting the **Urgent** booking type calculates `current_time + 50 minutes` dynamically via JavaScript (`getMinUrgentTime()`), setting the minimum time constraint (`min`) and initial value on the time picker.
- **50-Minute Service Guarantee Banner**: Displays an express notice (`.urgent-express-banner`) informing customers: *"Express Service Guarantee: We will provide your service within 50 minutes of your selected time."*
- **Validation**: Enforces a 50-minute minimum prep time when selecting today's time slots, preventing invalid past or immediate time selections with an informative toast notice.

## Minimalist Aesthetic Theme (Black, White, Blue, Green) (added 2026-08-05)

- **Color Palette Overhaul**: Restyled the entire platform using a modern minimalist aesthetic matching leading beauty & salon apps (Urban Company / Salon Prime):
  - **Crisp Surfaces**: Pure white (`#ffffff`) cards & modals on soft light gray (`#f8fafc`) page surfaces.
  - **Dark Typography & Accents**: Deep slate black (`#0f172a`) headings, body text, active sort pills, and floating menu buttons.
  - **Royal Indigo Blue (`#4f46e5`)**: Vibrant primary CTA accent for "Add" buttons, "View cart" floating bar, primary action buttons, and active indicators.
  - **Emerald Green (`#059669` / `#ecfdf5`)**: Vibrant discount offer badges (`20% OFF`, `10% OFF`), package tags (`■ PACKAGE`), and active duty indicators.
- **Files Modified**: Updated global variables in [static/css/variables.css](file:///Users/sachin/Documents/Poject/VindhyaTech/client_projects/GlamourAtHome/static/css/variables.css), component styles in [static/css/components.css](file:///Users/sachin/Documents/Poject/VindhyaTech/client_projects/GlamourAtHome/static/css/components.css), catalog styles in [static/css/booking.css](file:///Users/sachin/Documents/Poject/VindhyaTech/client_projects/GlamourAtHome/static/css/booking.css), and dashboard themes in [static/css/admin_dashboard.css](file:///Users/sachin/Documents/Poject/VindhyaTech/client_projects/GlamourAtHome/static/css/admin_dashboard.css).

## Package Services Auto-Calculation Backend & DB (added 2026-08-05)

- **Database Model Relation (`Service.included_services`)**: Added `included_services = ManyToManyField('self', symmetrical=False, blank=True)` to [catalog/models.py](file:///Users/sachin/Documents/Poject/VindhyaTech/client_projects/GlamourAtHome/catalog/models.py#L48-L60) allowing packages (`kind='package'`) to link multiple single services.
- **Auto-Calculated MRP & Duration**:
  - `total_included_duration`: Automatically sums individual service durations in minutes.
  - `total_included_mrp`: Automatically sums individual service prices to serve as the package **MRP**.
  - **Actual Price**: Owners set a custom discounted package price (`price`). The difference between `mrp` and `price` automatically generates the discount percentage badge (`discount_pct`).
- **Owner Dashboard & Django Admin Integration**:
  - Multi-select service picker with **live search filter** and **per-service variant selectors** added to [templates/admin_dashboard/services_list.html](file:///Users/sachin/Documents/Poject/VindhyaTech/client_projects/GlamourAtHome/templates/admin_dashboard/services_list.html) and [catalog/admin.py](file:///Users/sachin/Documents/Poject/VindhyaTech/client_projects/GlamourAtHome/catalog/admin.py).
  - Hide variant creation section for packages — only single services support variant management.
  - Real-time client-side JS auto-calculates total MRP & duration as single services and variants are selected/unselected.
- **Customer Package Customization & Proportional Discount**:
  - Interactive variant dropdowns rendered on customer package cards in [templates/booking/components/catalog_card.html](file:///Users/sachin/Documents/Poject/VindhyaTech/client_projects/GlamourAtHome/templates/booking/components/catalog_card.html).
  - When customers switch variants for included services, `onCustomerPackageVariantChange()` in [static/js/booking.js](file:///Users/sachin/Documents/Poject/VindhyaTech/client_projects/GlamourAtHome/static/js/booking.js#L1118-L1150) updates the total MRP, package price, and total duration in real-time while keeping the package **discount % constant**.
- **Marketing Landing Page Integration ([core/booking_data.py](file:///Users/sachin/Documents/Poject/VindhyaTech/client_projects/GlamourAtHome/core/booking_data.py#L60-L82) & [core/views.py](file:///Users/sachin/Documents/Poject/VindhyaTech/client_projects/GlamourAtHome/core/views.py#L25))**:
  - Replaced hardcoded static mock packages on the marketing home page (`/`) with real database packages query `get_landing_packages()`. Packages added or modified by the owner are now immediately visible live on the homepage with their real included services and calculated prices.

## URL scheme rename to professional/industry-standard paths (added 2026-08-05)

Renamed every non-standard-looking URL path. Only the path string changed —
every `path(...)`'s `name=` kwarg was left untouched, so all `{% url %}` /
`reverse()` / `redirect()` call sites needed zero changes. What *did* need
manual fixes: raw path strings that don't go through Django's name-based
reversal — `LOGIN_REDIRECT_URL`/`LOGOUT_REDIRECT_URL` in `settings.py`, and
hardcoded `fetch()` URLs in `profile.js`/`booking_drawer.js` (the address
API and checkout endpoint), plus `core/mock_data.py`'s hero CTA hrefs.

| Old path | New path | `name=` (unchanged) |
|---|---|---|
| `/services-booking/` | `/booking/` | `services_booking` |
| `/service/<slug>/` | `/services/<slug>/` | `service_detail` |
| `/services-booking/profile/` | `/booking/profile/` | `profile` |
| `/services-booking/addresses/` | `/booking/addresses/` | `addresses_api` |
| `/services-booking/addresses/<id>/` | `/booking/addresses/<id>/` | `address_delete` |
| `/services-booking/book/` | `/booking/checkout/` | `create_booking` |
| `/services-booking/bookings/` | `/booking/my-bookings/` | `bookings_dashboard` |
| `/services-booking/bookings/<n>/cancel/` | `/booking/my-bookings/<n>/cancel/` | `cancel_booking` |
| `/owner-dashboard/...` | `/dashboard/...` | `admin_dashboard_*` |
| `/emp-dashboard/` | `/employee/` | `employee_dashboard` |

`/`, `/admin/`, `/accounts/...` (allauth), `/robots.txt`, `/sitemap.xml`
were already fine and untouched. Rationale: `/booking/` groups the whole
customer booking surface under one clean prefix instead of repeating the
awkward "services-booking" compound on every route; `checkout` and
`my-bookings` are the conventional e-commerce terms for "create an order"
and "view my order history"; `/dashboard/` is the standard umbrella for a
staff/owner back office (distinct from Django's own `/admin/`); `emp` was
spelled out to `employee` for the same reason.

## Rebrand: Glamour At Home → Elix (added 2026-08-05)

Business name changed to **Elix**, tagline to **"Premium Salon at Home."**
Almost every visible mention flows from `settings.py`'s `SITE_NAME`/
`SITE_TAGLINE`/`SITE_DESCRIPTION`/etc. through `core/context_processors.py`'s
`SITE` context var — most templates already consumed `{{ SITE.name }}`, so
editing those constants in one place was enough for them. What had to be
hand-fixed were the literal strings that don't flow through `SITE`:

- **Logo wordmark**: every `Glamour<span>At</span>Home` (navbar, mobile
  drawer, footer, auth pages) became `<span>E</span>lix` — a single short
  word has no natural 3-part split like "Glamour / At / Home" did, so the
  existing gold-italic accent span now highlights just the first letter
  instead of a whole middle word. The admin sidebar's `Glamour<span>Admin</span>`
  became `Elix<span>Admin</span>` — that one still splits naturally.
- **`SITE.tagline` was dead code** — defined in settings/context processor
  but never actually rendered anywhere. Wired it into
  `templates/partials/meta.html`'s `<title>`, `og:title`, and
  `twitter:title` (previously a hardcoded "Luxury Beauty Services At Your
  Doorstep" string) so the tagline is now genuinely live, not just SEO
  config nobody reads.
- **Hero headline** (`core/mock_data.py::get_hero()`): `headline_lines`
  changed from the old 3-line marketing copy to `['Premium Salon',
  'at Home.']` — the actual tagline, split across two lines — so the most
  prominent on-page text matches what the `<title>` tag now says instead
  of contradicting it.
- **Booking number prefix**: `GAH######` → `ELX######`
  (`bookings/models.py::_generate_booking_number`) — customer-facing (shown
  on confirmations, `/booking/my-bookings/`, the owner/employee
  dashboards), so it needed to match the new brand too.
- **`SITE_ADDRESS`** was also corrected from a stale `'Bengaluru,
  Karnataka, India'` to `'Indore, Madhya Pradesh, India'` while touching
  this block — bundled in since it's the same "brand identity" config and
  was already known-wrong (see the earlier Indore-only fixes above).
- Remaining literal mentions (`chat_panel.html`'s assistant name,
  `why_us.html`'s eyebrow, `core/apps.py`'s `verbose_name`,
  `core/views.py`'s one `page_title` f-string, CSS file header comments,
  `README.md`'s title, an employee-email form placeholder) were fixed
  individually — either switched to `{{ SITE.name }}` where a template var
  was already in scope, or to `settings.SITE_NAME` in the one Python view
  that builds a title string outside any template.

**Deliberately left alone** — internal code identifiers invisible to site
visitors, same reasoning as not renaming the Django project folder itself:
the JS global `window.GlamourBooking` (set in `booking.js`, read in
`booking_drawer.js`/`bookings_dashboard.js`/`profile.js`/
`service_detail.html`) and the `GlamourAtHome` Python package/settings
module name. Both are pure internal naming with real rename risk (a missed
occurrence silently breaks cart/booking JS) and zero visible benefit — say
so explicitly if a fully brand-consistent codebase (not just brand-consistent
*site*) is wanted later.

## Real ratings & reviews (added 2026-08-06)

New `bookings.Review` model — one per completed `BookingItem` (not per
`Booking`, since a single booking can contain several different
services, each earning its own rating), `OneToOneField` so a customer
can't review the same item twice. `service` is denormalized onto Review
directly rather than reached via `booking_item.service_variant.service`
because `service_variant` is nullable (`SET_NULL` on deletion) — a review
must keep pointing at the right Service even after its originating
variant is deactivated.

- **Submit**: `bookings/views.py::submit_review` (`POST
  /booking/my-bookings/reviews/<item_id>/`) — `get_object_or_404(...,
  booking__user=request.user, booking__status='completed')` doubles as
  both the ownership check and the "only completed bookings" gate, same
  404-not-403 pattern as `cancel_booking`. Recomputes
  `Service.rating`/`reviews_count` from real `Review` rows via
  `Avg`/`Count` on every submission — these fields already existed on
  `catalog.Service` but were previously just seeded/mock numbers.
- **UI**: `bookings_dashboard.html` — each item in a `completed` booking
  gets a `<details>`-based "Rate & Review" toggle (zero extra JS) with a
  rating `<select>` + optional comment `<textarea>`; once reviewed, shows
  the submitted stars + comment instead. Star rendering everywhere reuses
  the existing `{% load glamour_extras %}` `times` filter
  (`{% for _ in rating|times %}★{% endfor %}`) already used by
  `testimonials.html` — not a new pattern.
- **Display**: `core/views.py::service_detail`'s `reviews` context var
  switched from a hardcoded 3-item mock list to
  `service.reviews.select_related('user').order_by('-created_at')[:20]` —
  the template's stars are now dynamic (were hardcoded `★★★★★` regardless
  of actual rating) and there's a real empty state ("No reviews yet…")
  instead of always showing fake reviews.
- **Privacy**: `Review.display_name` shows first name + last initial
  (falls back to the email's local part) rather than a full name or
  email, since these reviews render on a public service page.

Found but **not fixed** while in this area (out of scope for this
change, flagging for later): `bookings/views.py::COUPON_RATES` still has
`GLAM10` as a coupon code — a leftover from the Elix rebrand that the
"Glamour"-literal grep sweep didn't catch since it's a partial/abbreviated
match, not the full brand name.

## Job status workflow, arrival photo + start-OTP gate, face reference photos (added 2026-08-06)

Three related additions to the employee/beautician flow, all built together
since they form one pipeline: a job now moves through
**Pending → On The Way → (arrival photo + customer OTP) → Job Started →
Completed** (or Cancelled from most states).

**Media infra — new to this project.** No `MEDIA_ROOT`/`MEDIA_URL` or
`ImageField` existed anywhere before this. `GlamourAtHome/settings.py`
now defines `MEDIA_URL = '/media/'` / `MEDIA_ROOT = BASE_DIR / 'media'`;
`GlamourAtHome/urls.py` serves it in `DEBUG` alongside static files. Pillow
was already an installed dependency (unused until now). **Needs a real
storage backend (e.g. S3) before production** — local disk under
`MEDIA_ROOT` doesn't survive redeploys on most hosts.

**Status labels, not values, changed.** `Booking.STATUS_CHOICES`
label-only rename: `'upcoming'` now displays "Pending" (was "Upcoming"),
`'in_progress'` now displays "Job Started" (was "In Progress") — the
stored DB values are untouched, so every existing
`filter(status='upcoming')`/etc. across the codebase kept working with no
data migration. `'on_the_way'` is the one genuinely new stored value,
inserted between them. `Booking.can_cancel` was left as-is (gates on
`status == 'upcoming'` only) — correctly and harmlessly excludes
`on_the_way` from customer self-cancel eligibility.

**Arrival photo — deliberately not matched by any ML.** `Booking.
verification_photo` just saves whatever the employee uploads when marking
arrival; there is no face-recognition/matching against `Employee.
face_photo_*` today. It exists purely as a human-checkable record (an
owner can look at it if a customer disputes who showed up). A future
upgrade could add real matching against the employee's reference photos
below — nothing here assumes that will happen.

**Start OTP — the actual gate past "On The Way".** Saving the arrival
photo (`upload_verification` action) generates a 6-digit numeric
`Booking.start_otp` (`secrets.choice`, same crypto-appropriate pattern as
`_generate_booking_number`), stamps `otp_generated_at`, and clears any
prior `otp_verified_at`. `OTP_VALIDITY = timedelta(minutes=20)` in
`core/employee_dashboard_views.py`; `regenerate_otp` is the escape hatch
once it lapses. `verify_start_otp` checks status/expiry/match before
flipping the booking to `in_progress` and stamping `otp_verified_at`.

**OTP delivery — in-app for now, SMS later by design.** No real SMS/email
gateway exists in this project (`EMAIL_BACKEND` is still the dev-only
console backend). Per explicit decision, the OTP is simply rendered on the
customer's own `/booking/my-bookings/` page
(`templates/booking/pages/bookings_dashboard.html`) whenever their booking
is `on_the_way` with an unverified `start_otp` — no extra view context was
needed since `bookings_dashboard` already passes real `Booking` instances
to the template. **The swap point for a real SMS gateway later is exactly
this one display condition** — nothing about `start_otp`/
`otp_generated_at`/`otp_verified_at` needs to change, only where/how the
code reaches the customer (send it via SMS at the moment
`upload_verification` generates it, instead of/in addition to rendering it
here).

**Employee actions** (`core/employee_dashboard_views.py`): `mark_on_the_way`,
`upload_verification`, `regenerate_otp`, `verify_start_otp`, and (for the
face photos below) `upload_face_photos` — all follow the established
`get_object_or_404(Booking, id=booking_id, assigned_beautician=employee)`
ownership pattern. Fixed in passing: `update_booking_status` and
`mark_paid` previously had **no ownership check at all** — any
authenticated employee could modify any booking by id. Both now carry the
same `assigned_beautician=employee` check as every other action.

**Face reference photos.** `Employee` gained 5 `ImageField`s
(`face_photo_front/left/right/top/bottom`, each with a `help_text`
capture instruction) plus a `face_photos_complete` property. Uploaded from
a new "Face Verification Photos" section in the employee dashboard's
Profile tab (`templates/employee_dashboard/emp_dashboard.html`) — 5 slots,
each with an inline-SVG instructional diagram (no real sample photos
exist, so these are simple stylized diagrams, not photos), the pose
instruction text, a live thumbnail preview once uploaded, and a file input
that auto-submits on choose (`onchange="this.form.submit()"`, one slot at
a time — `upload_face_photos` accepts any subset of the 5 field names so
partial uploads work). Not matched against anything today — same
no-ML-yet note as the arrival photo above; these are the reference set a
future matching feature would compare against.

**Verified end-to-end** via a Django test-`Client` script driving the
full sequence (mark on-the-way → upload arrival photo → OTP appears on
the customer's page → wrong OTP rejected → correct OTP starts the job →
OTP disappears from the customer's page → regenerate OTP → expired OTP
rejected → all 5 face photos upload individually and
`face_photos_complete` flips correctly → a second employee gets a 404
trying to act on someone else's booking), then a couple of direct
`GET /employee/` checks for template-rendering correctness (no
`TemplateSyntaxError`/`VariableDoesNotExist`, right buttons/badges present
per status). Test users/bookings/uploaded media were all cleaned up after.

**Follow-up fix (same day):** `upcoming_bookings` in
`core/employee_dashboard_views.py` filtered `status__in=['upcoming',
'in_progress']` — written before `on_the_way` existed. A job scheduled
for a future date (so excluded from `today_bookings`, which only matches
`scheduled_date == today`) that got marked on-the-way matched neither
list and vanished from the dashboard entirely. Fixed by adding
`'on_the_way'` to that filter. (Noted but not fixed, same class of bug:
`core/admin_dashboard_views.py`'s `dashboard_bookings` status-filter
dropdown is also still `['upcoming', 'in_progress', 'completed',
'cancelled']` — an owner can't filter the bookings list by "On The Way"
either.)

**Follow-up change (same day): live-camera-only capture, no gallery
upload.** Both the arrival/"face verification" photo and the 5 profile
face-reference photos were originally plain `<input type="file"
capture="user">` pickers — `capture` is only a *hint* on most
browsers/OSes, and a determined user can still back out to their photo
gallery and pick an old image, which defeats the point of "this proves
someone was physically there right now." Replaced both with a shared
in-browser camera modal (`#empCameraModal` in
`templates/employee_dashboard/emp_dashboard.html`, opened by any
`[data-open-camera]` button) built on `getUserMedia()` + `<canvas>` —
there is no `<input type="file">` anywhere in either flow anymore, so
there's no gallery-picker path to bypass live capture at all.

- One button opens the modal for both use cases; `data-camera-mode`
  ("verification" vs "face") on the clicked button tells the shared JS
  what to POST on save: `data-booking-id`/`data-booking-number` for the
  arrival photo (→ `upload_verification`), or `data-face-field` (e.g.
  `face_photo_front`)/`data-face-label` for a profile slot (→
  `upload_face_photos`). Same CSRF-cookie-read pattern (`getCsrfToken()`)
  already used in `booking_drawer.js`/`profile.js`, reused here inline
  rather than extracted to a shared file since this is the first fetch-
  based POST in the employee dashboard.
- Capture flow: live `<video>` (mirrored via CSS only, for a natural
  selfie-preview feel) → "Capture" draws the current frame to a hidden
  `<canvas>` → `canvas.toBlob('image/jpeg', 0.9)` → shown back as an
  **unmirrored** `<img>` preview (so what's reviewed before saving
  matches what's actually stored) → "Use This Photo" POSTs the blob via
  `fetch()`/`FormData` and reloads the page on success; "Retake"
  restarts the camera stream instead of re-opening the modal.
- Camera permission/hardware failures surface inline
  (`[data-camera-error]`) rather than silently failing — covers no
  `getUserMedia` support and denied/unavailable camera.
- **Backend endpoints (`upload_verification`, `upload_face_photos`)
  didn't need to change at all** — they already just read whatever
  arrived in `request.FILES`; a JPEG blob from `canvas.toBlob()` looks
  identical to one from a file input at that layer. This is the same
  "swap the front end, not the contract" shape as the OTP-delivery
  design above.
- Verified via real Chrome (not just the test-`Client` script) using
  `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`
  (synthetic camera feed, no real hardware/permission prompt needed) to
  drive both flows end-to-end over CDP: open modal → confirm live video
  has real frames (`videoWidth > 0`) → capture → confirm preview/Save
  appear → save → confirm page reload shows the resulting state (OTP
  input appeared; face-photo slot now shows a preview and its button
  reads "Retake"). Test browser profile, server process, and uploaded
  media were all cleaned up after.

**Follow-up fix (same day): `[hidden]` was silently a no-op site-wide.**
The first round of camera-modal testing above only asserted the DOM
`.hidden` *property* after each click — which was always correct — so it
missed that the modal never visually closed. Root cause: `base.css`'s
`img, svg, video { display: block; ... }`, plus `.emp-btn { display:
inline-flex; }` and the modal's own `.emp-camera-modal { display: flex;
... }`, are **author-origin rules with an unconditional `display`** —
and author rules always beat the browser's own `[hidden] { display:
none }` default *regardless of selector specificity*, since origin (UA
vs. author) is resolved before specificity in the cascade. Net effect:
toggling `hidden` via JS on any element that also carries a class
setting `display` did nothing visually — the modal, its video feed, and
its buttons were always rendered, no matter what state the JS thought
it was in. Fixed with one rule in `base.css` right after the img/svg/
video reset: `[hidden] { display: none !important; }` — the standard,
widely-used fix for exactly this conflict, and it now protects every
future use of the `hidden` attribute anywhere on the site, not just this
modal. Re-verified with a second CDP pass that checks actual
`getComputedStyle`/`getBoundingClientRect` per element (not just the
`.hidden` property) — this is the check that should have caught it the
first time, and now does.

## AJAX-ified employee & admin dashboard actions (2026-08-06)

Every status/action form on the employee dashboard and the admin
bookings page previously did a plain POST + `redirect()` — a real
browser navigation. Two concrete complaints from this: on the employee
dashboard, any action (mark paid, mark on-the-way, leave request, ...)
reset the visible tab back to "Today" regardless of which tab the
employee was actually on, since tab state (`switchEmpTab`) is pure
client-side JS with no server-side memory. On the admin bookings page,
updating a booking's status or reassigning its beautician POSTed to the
form's own `action` attribute (`{% url 'admin_dashboard_bookings' %}`,
no query string), so the subsequent redirect landed back on the
*unfiltered* "All Orders" view — losing whatever status filter/search/
date the owner had applied.

**Employee dashboard** (`templates/employee_dashboard/emp_dashboard.html`):
wrapped everything that can change after an action (header incl. duty
toggle, tab nav incl. badge counts, messages, stats, all 4 tabs) in
`<div id="empDashboardRoot">`, styled `display: contents` so it's
invisible to `.emp-shell`'s flex layout. A single delegated `submit`
listener on `document` catches every form inside that root, POSTs via
`fetch` instead of letting the browser navigate, and replaces
`#empDashboardRoot`'s innerHTML with the same element parsed out of the
response (the view still returns the exact same rendered page after a
redirect — `fetch` follows redirects transparently, so this is just "do
what the browser would have done, minus the navigation"). A
`currentEmpTab` JS variable tracks whichever tab is open and gets
re-applied (`showEmpTab`) after every swap, which is what actually fixes
the "resets to Today" complaint. `cancel_leave`'s inline
`onsubmit="return confirm(...)"` became a `data-confirm` attribute read
by the same delegated handler (an inline handler and a delegated
`addEventListener` both firing on the same event is a real footgun —
this keeps confirm-then-maybe-preventDefault in one place). Theme toggle
and the camera-open buttons were also switched from
`querySelectorAll(...).forEach(addEventListener)` at `DOMContentLoaded`
to delegated listeners, since those buttons live inside the swapped
root and a per-element binding would silently stop working on the next
AJAX-rendered copy of the button. The camera modal's own save handler
(arrival photo + face photos) was switched from
`.then(() => window.location.reload())` to the same swap-in-place
(`applyDashboardHtml`), closing the modal explicitly first since it
lives outside `#empDashboardRoot` and wouldn't reset on its own.

**Admin bookings page** (`templates/admin_dashboard/bookings_list.html`):
same shape, scoped tighter since `bookings_list.html` shares
`admin_base.html` with every other admin page. `admin_base.html` now
wraps its messages block + `{% block content %}` in
`<div id="adminContentRoot">` (also `display: contents`) — a harmless,
inert change on pages that don't use it. The actual AJAX interception
JS lives only in `bookings_list.html`'s `{% block extra_body %}`, so
other admin pages (overview, services, employees) are completely
unaffected. Two things this page's handler had to get right that the
employee one didn't: (1) it must skip the toolbar's search/date `<form
method="get">` — the delegated listener explicitly checks
`form.method.toLowerCase() === 'post'` before intercepting, since that
one *should* navigate (filters belong in a shareable/bookmarkable URL);
(2) it POSTs to `window.location.href` (current URL, filters included),
not the form's own `action`, specifically so the swapped-in response
reflects the *same filtered view* the owner had open — this is the
actual fix for "loses the filter." The beautician-assignment `<select>`'s
`onchange="this.form.submit()"` was changed to
`this.form.requestSubmit()` — `.submit()` does not fire a `submit`
event at all (a real, easy-to-miss DOM quirk), so the delegated listener
could never have intercepted it otherwise; `requestSubmit()` fires the
same event a real Save-button click would.

**Verified** over real CDP (no fake devices needed for the non-camera
parts): planted a `window.__marker` before each action and confirmed it
survives (proof no real navigation occurred) for mark-paid, arrival-photo
upload, and both admin actions; confirmed the active employee tab stays
put across an action taken from a *different* tab's booking; confirmed
the admin's active status filter and URL are unchanged after updating a
status or reassigning a beautician; confirmed the underlying data
actually changed in each case (not just cosmetically) by reading the DB
directly after each fetch. Test users/bookings and browser/server
processes were all cleaned up after.

**Follow-up fix (same day): disabled fields were silently dropped from
the submitted data.** The admin bookings page's AJAX handler disabled
`form.querySelectorAll('button, select')` — for UX (prevent double-
submit) — *before* building `new FormData(form)`. A disabled `<select>`/
`<input>` is excluded from `FormData` entirely, per spec — so `status`,
`payment_status`, and `beautician_id` were all missing from every
request. Effect: "Update Status" silently did nothing (no `status` in
`request.POST` → nothing matched `dict(Booking.STATUS_CHOICES)`), and
"Assigned Staff" always unassigned regardless of what was picked (no
`beautician_id` → the view's `else` branch, which explicitly sets
`assigned_beautician = None`, ran every time). Fixed by snapshotting
`new FormData(form)` *before* disabling anything. The employee dashboard
never had this bug — its handler only disables the submit `<button>`
(which carries no `name` attribute, so it wasn't in the payload anyway),
never the data-carrying fields. Re-verified via real CDP interaction
(set a `<select>`'s value, dispatch `change`/click Save exactly as a user
would) confirming both the DB and the re-rendered `<select>` reflect the
chosen value, not "unassigned"/unchanged.

**Follow-up fix (same day): `form.action` was silently the wrong thing on
the employee dashboard.** Every form on that page has `<input
type="hidden" name="action" value="mark_paid">` (etc.) — and a named
form control shadows a same-named IDL property on its `<form>` element.
So `form.action` in the AJAX handler wasn't the form's URL at all; it
was the `<input name="action">` element itself. `fetch(form.action, ...)`
then coerced that element to the string `"[object HTMLInputElement]"`,
used it as a relative URL, and hit a 404 every single time — silently,
since the `.then()` chain still ran on the 404's response body (Django's
404 page has no `#empDashboardRoot`, so `applyDashboardHtml` found
nothing to swap and returned early, leaving the old page exactly as it
was with a **stale** message from whatever the previous real action had
been — which is why "Collect & Mark Paid" *looked* like it did something
but the payment status never actually changed). Confirmed directly via
CDP: `typeof form.action` was `"object"`, `r.url` after fetch was
`.../employee/[object%20HTMLInputElement]`, status 404. Fixed with
`form.getAttribute('action')` instead — reads the literal HTML attribute,
which named-control shadowing doesn't touch. Nothing else on the site
had this exact pattern (the admin bookings page posts to
`window.location.href`, and the camera modal posts to a hardcoded
`{% url %}` string — neither ever reads `.action` off a form). Re-verified
with a **real mouse click** dispatched via CDP's `Input.dispatchMouseEvent`
(not a scripted `.requestSubmit()`, which is what all the *earlier*
"this works" verifications in this file used, and which apparently never
exercised this exact code path in a way that surfaced the bug) —
payment status now correctly flips to Paid in both the DB and the
re-rendered badge.

## Cancellation window simplified: any time before "On The Way" (2026-08-06)

The original cancel rule (see "Cancel booking" above, added 2026-08-01)
was `status == 'upcoming'` AND more than `CANCELLATION_CUTOFF` (3h)
before `scheduled_start`. Changed to just `status == 'upcoming'` — a
customer can now cancel right up until the beautician marks the job "On
The Way" (the point real effort starts being spent), with no separate
time-based cutoff. Since `on_the_way` is a distinct status from
`upcoming` (added for the job-status-workflow feature above), this one
condition already fully captures "before the beautician heads out" —
the 3h/`scheduled_start` math was solving a problem that status field
now solves more precisely on its own.

`Booking.scheduled_start`, `SLOT_START_TIMES`, and `CANCELLATION_CUTOFF`
were deleted from `bookings/models.py` rather than left dead — nothing
else in the codebase referenced them (confirmed via grep before
removing). `templates/booking/pages/bookings_dashboard.html`'s cancel
block had an inner `{% if booking.can_cancel %}` nested inside an outer
`{% if booking.status == 'upcoming' %}` — now redundant since the two
conditions are identical, so simplified to a single `{% if
booking.can_cancel %}` and the now-unreachable "can't be cancelled —
starts within 3 hours" note branch (plus its now-dead
`.booking-card__cancel-note` CSS rule) were removed rather than kept
as dead code.

## Same-day slot availability: fixed a dead code path (2026-08-06)

The "hide past morning/afternoon slots for a same-day regular booking"
feature already existed (`updateRegularSlotsAvailability()` in
`static/js/booking_drawer.js`, server-enforced too in
`create_booking()`) — it just never ran on the most common path into the
booking drawer: opening it fresh. `resetState()` defaults `state.date` to
today and calls `renderCalendar()`, but never
`updateRegularSlotsAvailability()` — that only ran from the calendar's
own click handler and the booking-type toggle. A customer who never
touched the calendar (today was already pre-selected) or the type toggle
would see every slot enabled regardless of the actual time. Fixed by
calling the right one (`updateRegularSlotsAvailability()` or
`populateUrgentTimeDropdown()`, depending on `state.type`) every time
step 3 ("Booking type & time") is entered, in `goToStep()` — covers the
initial default-date case and guards against staleness if a customer
sits on an earlier step for a while before reaching step 3.

## Package customization now actually reaches the cart and the charge (2026-08-06)

Packages (`Service.kind == 'package'`) let a customer pick a variant for
each included service, and the catalog card / detail page already
recalculated and *displayed* a new total price — but that was cosmetic
only. The cart line stayed a flat `{id, variantId, qty}`, so whichever
variants the customer picked were discarded the moment they clicked Add
to Cart; `create_booking()` only ever resolved the package's own base
`ServiceVariant`, and no template ever expanded a package's contents for
display — so job cards/dashboards always showed exactly one line
("Test Combo Package") no matter how many services were actually inside
it, and a customized package always charged the same flat price
regardless of what was picked.

**Decision (confirmed with the user first, since it's a pricing
question): a customized package's price follows the selection** — sum
of the chosen included-service variants' prices, with the package's own
discount percentage applied to that new total. Not "customization only
picks which variant you get, price stays fixed."

**Cart line shape extended**: `{id, variantId, qty, included}`, where
`included` is `{includedServiceId: chosenVariantId}` — present only for
packages, so every non-package cart line's shape is untouched.
Dedup (`lineKey`/`lineMatches` in `booking.js`) now also matches on a
stable serialization of `included`, since two different customizations
of the same package are separate lines, not one line whose qty bumps.

**Single source of pricing truth**: `computePackagePricing(item,
included)` (module-level in `booking.js`, exposed via
`window.GlamourBooking`) — sums the resolved variant per included
service (falling back to that service's own default variant when
unset/invalid), applies `item.discount_pct` if any, returns
`{price, mrp, duration_mins, breakdown}`. Every place that needs to show
or charge a package's price calls this same function: the catalog
card's live preview (`onCustomerPackageVariantChange`, previously its
own hand-rolled copy of this math), the service detail page's preview
(`recalculateDetailPackageTotal`, ditto), the mini-cart panel's line
price (`render()`), and `booking_drawer.js`'s `cartTotal()`/
`renderSummary()` (via `linePrice()`) — so the number a customer sees in
the drawer's final review step can never drift from what
`create_booking()` actually charges. `gatherIncludedSelections(container)`
reads whichever variant is currently selected for each included service
out of the DOM (`[data-inc-id]` on both the `<select>` for
multi-variant included services and the `<input type="hidden">` for
single-variant ones — the hidden input previously carried no id/value at
all, just display-only `data-price`/`data-duration`) — shared by the
catalog card's Add-to-Cart handler and `service_detail.html`'s
`addDetailItemToCart()`, both of which now call the also-newly-exposed
`GB.addItem(id, variantId, included)` instead of hand-rolling their own
cart push (the detail page's old version had its own latent dedup bug —
`i.variantId === activeVariantId` compared a stored number against a
string, so re-adding the same variant always created a duplicate line
instead of bumping qty; using the shared `addItem()` fixes that for
free).

**Server-side (`bookings/views.py::create_booking`) never trusts the
client's price** — it re-resolves `included` itself: for each of the
package's `included_services`, looks up the client-sent variant id
*scoped to that specific included service* (so a variant id belonging to
a different service, or a nonexistent one, can't be smuggled in — it
just silently falls back to that service's own default variant, no
error), then **only overrides the package's price/duration when at
least one resolved variant actually differs from that service's
default** (`any_customized`). This matters: recomputing "sum of included
defaults × package's own discount%" unconditionally would NOT
necessarily reproduce the package's own stored price — verified this
gap is real on the seeded "Test Combo Package" data (sum of its included
services' current defaults is ₹3116; the package's own stored mrp is
₹1917 — they'd drifted apart since seeding). Gating on `any_customized`
means an un-customized package keeps charging exactly what it always
charged, byte-for-byte, and only a genuinely customized one gets the new
computed price — zero risk of silently repricing existing/default
bookings.

**New `BookingItem.included_snapshot`** (`JSONField`, default `[]`,
migration `0005_bookingitem_included_snapshot`) — populated for every
package `BookingItem` (customized or not) with each included service's
name/variant label/price/duration at booking time. This is what fixes
the "job card doesn't show all services in a package" complaint:
`job_card.html` and `bookings_dashboard.html` now render this as a
nested sub-list under the package's line. Deliberately a snapshot of
what was actually resolved for *this* booking (customer's picks, or
defaults) rather than re-deriving from `Service.included_services` at
display time — a package's included-services list or their variants can
change after the fact; a past booking's receipt shouldn't.

**Verified**: server-side via direct requests exercising four cases
(no `included` key at all → unchanged; `included` present but matching
every default → unchanged; a garbage/nonexistent variant id → falls back
silently, no 500; a variant id that's real but belongs to a *different*
included service → rejected, falls back) — all confirmed against the
real seeded package (5 included services, one with 3 variants, one with
5), and one genuine customization (Half Arms → Rica Wax) confirmed to
produce exactly the hand-computed price (₹849) and duration (205 min).
Then re-verified the client side over real Chrome: changing the
included-service dropdown updates the live preview to the same ₹849,
clicking Add to Cart captures all 5 included selections (not just the
one that changed) into the cart line, adding the identical customization
twice bumps qty to 2 on one line, and adding a *different* customization
of the same package creates a genuinely separate line — matching the
dedup design exactly.

## Follow-up fixes to the package customization feature (2026-08-06)

Two real bugs surfaced immediately after shipping the above, both from
testing pieces in isolation rather than the full integration.

**"Proceed to Booking" silently stopped working — everywhere, not just
for packages.** `window.GlamourBooking = {...}` referenced `addItem` —
but `addItem` is a function declared *inside* `initFloatingCart()`'s own
scope, while that object literal was being built in the outer
`DOMContentLoaded` callback, outside it. Referencing an out-of-scope
identifier throws `ReferenceError` while the object literal is still
being constructed, which means the entire `window.GlamourBooking = ...`
assignment never completes — `window.GlamourBooking` stayed `undefined`
on every page load, breaking every single consumer: `service_detail.html`
's add-to-cart/preview (this is what made it look package-specific — the
error surfaced there first), and — far more importantly —
`booking_drawer.js`'s entire `GB.*` surface, i.e. the booking drawer
itself. The catalog page's own Add-to-Cart button kept working purely by
accident: its click handler is bound *inside* `initFloatingCart()` too,
so it already has `addItem` in scope directly and never goes through
`window.GlamourBooking` at all — the crash happens *after* that handler
is already attached, so it looked unaffected in isolation. Fixed by
moving the whole `window.GlamourBooking = {...}` assignment to be the
last statement inside `initFloatingCart()`'s own body, where every name
it references — locals like `addItem`, and module-level ones like
`getCart`/`computePackagePricing` via closure — is actually in scope.
Confirmed via a real page load: previously threw
`ReferenceError: addItem is not defined` at that exact line on *every*
page including the catalog listing (checked by capturing
`Runtime.exceptionThrown` on load, not just by eyeballing the code);
after the fix, `typeof window.GlamourBooking === 'object'` and the
drawer opens and renders step 1 correctly.

**Included-service name collapsed to invisible width on narrow
screens.** Both `catalog_card.html`'s and `service_detail.html`'s
"included services" rows used `justify-content: space-between` with no
`flex-wrap`, a fixed-width `<select>` for multi-variant included
services, and the name container's only shrink guard was `min-width: 0`
(i.e., "shrink as much as needed, down to nothing"). On a ~390px mobile
viewport, confirmed via actual `getBoundingClientRect()` measurements
that the name span's rendered width was ~0–5px for any included service
with a variant picker (the select's ~170px ate almost the entire ~266px
row), while a plain-price included service (no select) rendered fine —
matching the report exactly ("Half Arms"/"Full Body" showing no name,
just an image and a dropdown). Fixed by adding `flex-wrap: wrap` to the
row and giving the name container a real `flex-basis`/`min-width`
(140px on the detail page, 100px on the catalog card) so it can't be
squeezed below a readable width — once both can't fit on one line, the
select/price control wraps to its own line under the name instead of
crushing it. Re-verified at the same 390px viewport: name width went
from ~0-5px to ~60-66px for both previously-broken rows.

## Review UI redesign: inline stars per service, one shared comment per order (2026-08-06)

The old "Rate & Review" flow was a `<details>` accordion per `BookingItem`
— rating dropdown + its own comment textarea + its own Submit button,
repeated once per item, which read as a wall of near-identical forms on
any multi-item order (see the original screenshot: three near-identical
"Rate & Review" buttons stacked for a 3-item booking). Discussed the
redesign with the user first since it implied a real data-model
question — where does free-text feedback live if it's no longer
one-comment-per-item.

**Decision**: keep star ratings per service (unchanged meaning — still
feeds each `Service.rating`/`reviews_count`), but collect only *one*
free-text comment for the whole order. `Booking` gained two fields:
`feedback_comment` (`TextField`) and `feedback_submitted_at`
(migration `0006_booking_feedback_comment_and_more`) — a new
`submit_booking_feedback` view (`POST
/booking/my-bookings/<booking_number>/feedback/`) owns writing to them,
independent of `Review.comment` (which still exists on the model for
old rows but the current UI never writes to it — see that field's
updated docstring).

**Stars are inline and submit instantly, no button** — a row of 5
`<button>` elements per completed item
(`templates/booking/pages/bookings_dashboard.html`), painted via a
`data-star-picker[data-rating]` attribute reflecting the existing
`Review.rating` if any. Clicking one fills stars optimistically and
fires a `fetch` POST to `submit_review` immediately
(`static/js/bookings_dashboard.js::initStarRatings`) — no separate
Submit step. `submit_review` (`bookings/views.py`) changed from
"error if `hasattr(item, 'review')`" (one-shot, `Review.objects.create`)
to `Review.objects.update_or_create(booking_item=item, defaults={...})`
— clicking a *different* star later now re-rates in place instead of
being rejected, matching how every other star-rating widget behaves,
and matching the return type change: JSON (`{ok, rating}` /
`{ok: false, error}`) instead of a redirect + Django message, since
there's no page reload to carry a message through anymore. On a failed
request, the JS rolls the stars back to whatever rating was in place
before the click rather than leaving a rating painted that never
actually saved.

**One feedback box, one button, per booking** — a single `<textarea>` +
button living once per completed booking card (not per item), pre-filled
with any existing `feedback_comment`; the button reads "Submit Feedback"
or "Update Feedback" depending on `feedback_submitted_at`. Submits via
`fetch` to the new endpoint and flips its own label + reveals a "✓ Saved"
status inline, again no page reload.

**URLs resolved server-side into `data-*` attributes**
(`data-review-url`/`data-feedback-url`), not reconstructed in JS from a
hand-typed path pattern — `bookings_dashboard.js` is a plain static file
with no access to `{% url %}`, and hand-typing
`/booking/my-bookings/reviews/${id}/` there would silently drift the day
that URL pattern changes.

**Verified**: server-side directly (initial rating → DB check → update
to a different rating → confirmed still exactly one `Review` row, not
two → invalid rating rejected with 400 → feedback saved → a second user
attempting to rate someone else's item gets 404, not 403, same
ownership pattern as `cancel_booking`), then the actual click
interaction over a real browser — clicking star 4 on one item visibly
fills stars 1-4 only and leaves 5 unfilled, a second independent picker
on the same page correctly fills all 5 on a 5-star click (proving each
item's picker is scoped independently, not a shared/leaked state), and
the feedback textarea + button round-trip correctly updates its own
label and reveals the saved indicator — all confirmed against the
database afterward, not just the DOM.

## Three-tier authentication: Google/Apple → Phone OTP → password (added 2026-08-07)

Login and signup restructured around three priority tiers per the owner's
request: **Google/Apple sign-in first**, **phone-number OTP second**,
**username-or-email + password third** (now collapsed behind a `<details>`
on the login page — still fully functional, just visually de-emphasized).
Signup collects first name, last name, email, phone (mandatory), and age,
and auto-generates the username rather than asking the customer to pick
one.

**Don't build custom OTP — the installed library already has it.** Before
writing a `PhoneOTP` model, checked the actual installed
`django-allauth==65.18.0` source (not docs) and found it ships a complete
phone-login-by-code system: `RequestLoginCodeView`/`ConfirmLoginCodeView`
(`account_request_login_code`/`account_confirm_login_code`, gated behind
`ACCOUNT_LOGIN_BY_CODE_ENABLED = True`), rate limiting, code expiry/resend,
and a `PhoneField` with E.164 validation — all already installed. The only
genuinely new code needed was one adapter with five short methods
(`accounts/adapter.py::AccountAdapter`), since `DefaultAccountAdapter`'s
phone hooks all `raise NotImplementedError` by default:
`send_verification_code_sms` (does the real MSG91 call), `set_phone`/
`get_phone`/`set_phone_verified` (read/write `Profile.phone`/
`Profile.phone_verified`, both new fields), and `get_user_by_phone`
(`User.objects.filter(profile__phone=phone).first()`). Registered via
`ACCOUNT_ADAPTER` in settings.

**Username auto-generation shared with the employee scheme, not allauth's
own.** allauth's default `populate_username`/`generate_unique_username`
uses a random suffix, not the sequential-number scheme employee logins use
(`core/admin_dashboard_views.py::_create_employee_login`). Extracted that
scheme into `accounts/utils.py::generate_username_from_name` (lowercased
firstname+lastname, collision-suffixed `2`, `3`, ...), called from both
`_create_employee_login` (refactored, behavior unchanged) and
`AccountAdapter.populate_username` (new) — one rule, one place, instead of
two copies drifting apart later.

**`first_name`/`last_name`/`age` aren't allauth signup fields.** Unlike
`email`/`phone`/`username` (added dynamically via `ACCOUNT_SIGNUP_FIELDS`),
allauth's `BaseSignupForm` has no concept of name or age fields at all.
Added them via a shared mixin (`accounts/forms.py::ExtraSignupFieldsMixin`)
whose `custom_signup()` saves `age` to `Profile` — mixed into two separate
subclasses, `CustomSignupForm` (extends `allauth.account.forms.SignupForm`,
registered via `ACCOUNT_FORMS`) and `CustomSocialSignupForm` (extends
`allauth.socialaccount.forms.SignupForm`, registered via
`SOCIALACCOUNT_FORMS`) — genuinely two separate settings keys read by two
separate allauth views, easy to miss one.

**MSG91 wired for real, not a placeholder.** Per explicit direction,
`send_verification_code_sms` makes a real HTTP call to MSG91's send-OTP
API (`MSG91_AUTH_KEY`/`MSG91_SENDER_ID`/`MSG91_TEMPLATE_ID`, new `.env`
keys, all empty today). With no real key yet, the call fails and is caught
(logged, not raised) — same "reserved slot, wire up later" pattern already
used for Google/Apple OAuth and Google Maps in this codebase. Once real
credentials land in `.env`, delivery starts working with zero code changes.
Apple Sign In (already partially wired from an earlier phase) follows the
same pattern — renders now, completes a real login only once credentials
are added.

**Templates**: `templates/account/login.html` reordered into the three
tiers (Google/Apple buttons on top, a "Continue with Phone Number" link
second, the existing username/password form third inside a collapsed
`<details>`). New `templates/account/signup.html` (none existed before —
signup previously fell through to allauth's unstyled default), new
`templates/account/request_login_code.html`/`confirm_login_code.html`
overrides for the phone-OTP flow, and a new `templates/socialaccount/
signup.html` override for the "complete your signup" step after a Google/
Apple login (asks only for what the provider didn't supply: phone, age).
All reuse the existing `auth-card`/`auth-group`/`auth-input`/
`auth-submit-btn`/`auth-social-btn` classes already in `auth.css`, plus a
handful of new ones for the two-column name row and the collapsed tier-3
section.

**Verified server-side** (Django test client, not a browser — signup with
phone+age → username matched the employee-style rule exactly →
`Profile.phone`/`age` saved; a second same-named signup collided correctly
to `name2`; confirmed `_create_employee_login` still behaves identically
after the refactor; called `send_verification_code_sms` directly and
confirmed the expected MSG91 failure — no real key yet — is caught rather
than raised; ran the full phone-login-by-code loop end-to-end — requested
a code, read it out of the session-stored login stage, submitted it back,
and confirmed the test client actually became authenticated as the right
user and `Profile.phone_verified` flipped to `True`).

**Follow-ups**: `send_verification_code_sms` now also `print()`s the code
to the console unconditionally (not just on MSG91 failure) — needed to
actually exercise the flow end-to-end without real MSG91 delivery.

**Resend was silently disabled by allauth's own default.** Both the
phone-login confirm page and the post-signup phone-verification page
already had a "resend" button wired in their templates, but it never
rendered — `can_resend` was always `False`, because allauth's
`ACCOUNT_LOGIN_BY_CODE_SUPPORTS_RESEND`/`ACCOUNT_PHONE_VERIFICATION_SUPPORTS_RESEND`
both default to `False` (which caps the resend quota at 0), a detail easy
to miss since nothing errors — the button just never appears. Added both
to settings.py (quota becomes 2 resends each once enabled). Also added a
`templates/account/confirm_phone_verification_code.html` override (the
actual post-signup "enter the code we texted you" page, previously left
on allauth's unstyled default) with the same styling and resend pattern as
`confirm_login_code.html`.

Verified via the Django test client: signed up → confirmed the code was
printed to console → requested a resend → confirmed a *different* code was
generated and printed → submitted the new code → `phone_verified` became
`True`. Also confirmed the login-by-code confirm page's resend button now
renders too.

## Security audit + penetration test (added 2026-08-07)

Ran a full read-only audit across `core`/`accounts`/`bookings`/`catalog`,
then personally exploited and fixed every real finding rather than just
listing them.

**Critical — employee-identity IDOR.** `employee_dashboard_views.py`
resolved "which employee is this?" partly via
`Employee.objects.filter(email__iexact=user.email)` — a fallback for
accounts without a direct `employee_profile` link. Proved exploitable:
created a real employee, then an unrelated attacker account with the
same email (`Employee.email` is just admin-entered contact info, not a
verified identity key) — the attacker got full access to that employee's
bookings, customer PII, `mark_paid`, and arrival-OTP verification.
Removed the fallback entirely; identity now resolves only through the
real link an admin establishes.

**Critical — stored-XSS via spoofed upload Content-Type.**
`core/utils.py::validate_image_upload` only checked the attacker-supplied
multipart `Content-Type` header. Proved exploitable: an HTML file with a
faked `image/jpeg` header was accepted. Fixed with a real extension
allow-list *and* Pillow (`Image.open(...).verify()`) decoding the actual
bytes — a script file can no longer pass as an "image" no matter what
headers/extension it claims.

**High — arrival-OTP-verification bypass.** `update_booking_status`
accepted any status transition directly, so an assigned employee could
jump straight from "upcoming" to "in_progress"/"completed", completely
skipping the On-The-Way → photo → OTP sequence built specifically to
prove physical arrival. Restricted that action to its one legitimate
transition (in_progress → completed, still payment-gated).

**Medium fixes**: re-enabled `ACCOUNT_RATE_LIMITS` (was `False` —
unthrottled login/OTP/reset is what makes credential-stuffing practical
at scale); replaced the predictable `Firstname2026` employee password
scheme with `Firstname` + 4 random digits (the old one was computable by
anyone who knows an employee's first name, which customers see); added a
5-attempt lockout to the arrival OTP (`Booking.otp_failed_attempts`) — a
6-digit code had no brute-force limit within its 20-minute window.

**Hardening** (`settings.py`, zero behavior change confirmed for local
dev): `SECRET_KEY` was hardcoded and committed to git — moved to `.env`
with the same value as a dev-only fallback; `DEBUG`/`ALLOWED_HOSTS` made
env-configurable; `SESSION_COOKIE_SECURE`/`CSRF_COOKIE_SECURE`/
`SECURE_SSL_REDIRECT` added, gated on `not DEBUG` so they activate
automatically the moment a real deploy flips that flag; the devtunnels
CSRF wildcard scoped to `DEBUG` only.

**A self-inflicted near-miss worth remembering**: the `ACCOUNT_RATE_LIMITS
= True` fix above was initially landed as a literal `True` — allauth's
`app_settings.RATE_LIMITS` property does `ret.update(rls)` on whatever
this setting is, and `dict.update(True)` raises `TypeError`, which would
have taken down *every* allauth view that checks a rate limit (login,
signup, password reset...) the moment it shipped. Caught immediately by
actually testing the fix with the Django test client rather than trusting
that "enabling" a boolean-sounding setting was safe — fixed to `{}` (the
real "use allauth's own defaults" value). Reinforces the standing rule in
this project: every fix gets exercised with a real request before being
called done, not just reasoned about.

## Real MessageCentral "Verify Now" phone-OTP + real Razorpay checkout (added 2026-08-07)

Two real payment-adjacent third-party credentials landed in `.env`
(`SMS_KEY`, `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`) — wired both up for
real, replacing what had been reserved-slot/dev-only paths.

**MessageCentral replaces allauth's login-by-code entirely, not MSG91's
role.** MSG91 (the earlier phone-OTP vendor, never given real credentials)
worked like a dumb relay: allauth generates its own 6-digit code, the
adapter's job is just to text it. MessageCentral's "Verify Now" product
is fundamentally different — *they* generate and validate the OTP
(`POST .../verification/v3/send` returns a `verificationId`; you never
see the code at all, only whether `GET .../validateOtp` later reports
`VERIFICATION_COMPLETED`). There's no way to hand it an allauth-generated
code to relay, so keeping allauth's own `send_verification_code_sms` hook
was a non-starter for this vendor — confirmed by directly researching
their current v3 API reference before writing any code, rather than
guessing at the shape from an older tutorial that turned out to describe
a different endpoint style (v2 vs v3 auth flow disagreed across sources).

Given that, tier-2 login ("Continue with Phone Number") is now a small
hand-built flow instead of allauth's own login-by-code
(`ACCOUNT_LOGIN_BY_CODE_ENABLED` switched off to avoid two competing
phone-OTP paths): `accounts/messagecentral.py` (thin REST client —
`send_otp`/`validate_otp`; the customerId is decoded straight out of the
API key's own JWT payload, since it already carries it as
`client_company_name`, avoiding a second manually-copied .env value) +
`accounts/phone_login_views.py` (`request_phone_login`/
`confirm_phone_login`, using Django's own session dict for the two-step
state — no allauth internals touched) + two new templates matching the
existing auth-card styling. Reuses the existing `IndianPhoneField`
(+91 auto-prepend) and `AccountAdapter.get_user_by_phone`/
`set_phone_verified` hooks, so signup's mandatory phone field and this
login path stay consistent. Added a 5-attempt lockout (mirroring the
arrival-OTP one above) and real rate limiting on the two custom actions
by adding them to the same `ACCOUNT_RATE_LIMITS` dict allauth's own
`ratelimit.consume()` reads — it works for any action name, not just
allauth's built-in ones. Removed the now-fully-dead MSG91 code and the
three allauth phone-OTP templates it no longer reaches
(`request_login_code.html`, `confirm_login_code.html`,
`confirm_phone_verification_code.html`).

**Razorpay**: replaced the fake "processing → success" `setTimeout` in
`booking_drawer.js` with a real Checkout.js integration.
`bookings/razorpay_client.py` (`create_order`/`fetch_order`/
`verify_payment_signature` — plain `requests` + HMAC-SHA256, no SDK
dependency, matching this project's pattern for every other third-party
integration). The cart→price resolution logic in
`bookings/views.py::create_booking` (variant lookup, package
customization, coupon math) was extracted into a shared
`_resolve_cart_pricing()` so a new `create_razorpay_order` endpoint and
`create_booking` itself compute the exact same total two different times
without any chance of drift. `create_booking` now requires and verifies
a real signature for `payment_method='pay_now'` — HMAC first, then a
second server-to-server call to re-fetch the order's amount from
Razorpay directly (never trusting anything client-supplied about what
was actually paid) — before marking a booking paid; `pay_at_home` is
untouched. New `Booking.razorpay_order_id`/`razorpay_payment_id` fields
for support/refund lookups.

**Verified** (mocked HTTP throughout — real API calls would spend the
client's actual credits/quota for no benefit over a mock proving the same
code paths): full phone-login flow (send → confirm → login →
`phone_verified=True`), wrong-code lockout after 5 attempts, resend
resetting the lockout counter, unknown-phone redirecting to signup
without logging anyone in; Razorpay order creation, a valid
signature+matching-amount payment correctly marking a booking paid, and —
critically — a forged signature, a tampered/mismatched amount, and
missing payment fields entirely all correctly rejected with **no booking
created** in any of the three cases; `pay_at_home` confirmed unaffected
throughout.

## MessageCentral: fixing the real auth flow against the live API (added 2026-08-07)

The mocked-HTTP verification above proved the *view/session* logic was
right, but the real API rejected every call with a bare `401` (no body
at all) once actually tried. Chased this down against the live API
rather than guessing further from docs, since the docs themselves turned
out to be self-contradictory:

- The dashboard's "Auth Token" (`SMS_KEY`) is **not** usable directly as
  the `authToken` header on send/validate, despite matching every
  documented shape — MessageCentral's own onboarding PDF confirms
  send/validate need a short-lived **session token** from
  `/auth/v1/authentication/token` first; the dashboard token is a
  different, longer-lived credential. That endpoint needs the actual
  dashboard *login password* (base64-encoded) as its `key` param — a
  second secret, added as `MESSAGECENTRAL_PASSWORD`.
- `validateOtp` specifically needs **GET**, not the POST its own docs'
  prose claims (their own example cURL for that one endpoint quietly
  uses GET) — and **no trailing slash** on the path. Either mismatch
  gets the same bare-401 gateway rejection as the wrong auth entirely,
  which is what made this so slow to isolate: several genuinely
  different root causes all produced an identical, contentless symptom.

`accounts/messagecentral.py::_generate_session_token` now performs that
exchange (cached via Django's cache for 6 hours, force-refreshed once on
a 401 to cover a token expiring server-side before the local guess
does). `send_otp`/`validate_otp` both route through
`_request_with_token_retry` for that retry-once behavior.

**Verified against the real live API** (not mocked — deliberately, since
this exact gap only showed up against the real service): generated a
real session token, sent a real OTP to a real phone, and validated the
real code the phone actually received — confirmed `VERIFICATION_COMPLETED`.
A second validation attempt against the same (by-then-expired, ~60s
window) code correctly came back `VERIFICATION_EXPIRED` rather than
silently "working" — confirming expiry is enforced by MessageCentral
itself, not just assumed.

## Fixed: password login silently failing for any phoneless account (added 2026-08-07)

Surfaced right after wiping all data (see below) — every remaining login
(a freshly `createsuperuser`'d account, an employee login from the admin
dashboard) has no `Profile.phone` at all, and every single one bounced
back to the login page with no error, just a server-side
`"Login stage aborted, redirecting to login"` log line.

Root cause: allauth's `PhoneVerificationStage` runs on **every** login
regardless of `ACCOUNT_PHONE_VERIFICATION_ENABLED` — that flag is only
consulted once a phone already exists on the account. For an account
with no phone at all, `AccountAdapter.get_phone()` returns `None`, and
since `ACCOUNT_SIGNUP_FIELDS` marks phone as required, the stage
interprets "required field, but nothing on file" as an unrecoverable
state and aborts the whole login pipeline rather than continuing —
`ACCOUNT_PHONE_VERIFICATION_ENABLED = False` (set earlier this session)
never actually covered this path. Fixed by overriding
`AccountAdapter.get_login_stages()` to drop `PhoneVerificationStage`
from the pipeline outright — phone verification only ever happens
through the optional MessageCentral-backed tier
(`accounts/phone_login_views.py`), never as a forced stage on password/
Google login. Verified: a phoneless account now logs in and reaches
`/booking/`; an account with an on-file-but-unverified phone still logs
in fine too (no regression).

## Full data reset: users, bookings, and packages wiped (added 2026-08-07)

At the user's explicit request (confirmed scope twice, given the
irreversibility): deleted every `User` (11, including staff/admin/
employee logins — cascading `Profile`/`Address`/allauth rows), every
`Booking` (3, cascading items/reviews), and every package-type `Service`
(2, cascading their variants) — leaving all 39 `kind='service'` Services
and their variants/categories untouched. `Employee` rows (5) were kept
as data since they weren't explicitly listed as a delete target — only
their `user` login link was nulled via its existing `on_delete=SET_NULL`.
A `db.sqlite3.backup-<timestamp>` copy was taken first as a cheap safety
net before running it. A fresh `createsuperuser` is needed to regain any
access to the site at all after this.

## Email/phone uniqueness enforced at the DB level (added 2026-08-07)

`auth.User` has no email-uniqueness constraint at all by default (a
well-known Django gotcha, and not fixable by adding `unique=True` in a
migration since it's Django's own built-in model, not ours to alter).
Added partial/conditional unique indexes instead — `CREATE UNIQUE INDEX
... WHERE column != ''` — on `accounts_profile.phone` and
`auth_user.email`, via raw `RunSQL` rather than `AlterField`. The
`WHERE` clause matters: plenty of legitimate rows have a blank phone or
email (pre-phone-mandatory accounts, admin/employee accounts), and a
plain `unique=True` would treat every blank as a value that itself must
be unique — the second blank row would violate it.

Traced through allauth's actual signup validation (`assess_unique_email`/
`_clean_phone`) and confirmed it already silently prevents duplicate
signups given this project's settings (`ACCOUNT_EMAIL_VERIFICATION=
'optional'` + default `PREVENT_ENUMERATION=True` lands in the "uniqueness
takes precedence" branch). The real gaps were two admin-side paths that
bypass that form entirely — `dashboard_employees`'s `add_employee`/
`generate_login`, which set a linked User's email with no check at all —
now given a friendly pre-check instead of a raw `IntegrityError`. Same
for `accounts/views.py::profile_view`'s phone field. Verified: blank
phones/emails never collide with each other, real duplicates are
blocked with a clean message (not a 500) at every write path checked,
and normal signup/profile-edit/employee-creation are all unaffected.

## Role-based access control: owner/emp/customer groups (added 2026-08-08)

Surfaced by a real bug: an employee account (`sachinshah`) had
`is_staff=True` — never set by any app code, presumably left over from
`createsuperuser`/manual DB edits — which incidentally granted full
owner-dashboard access alongside the employee dashboard, since
permission checks up to this point leaned on `is_staff`/`is_superuser`
rather than anything role-specific. Fixed by removing `is_staff`/
`is_superuser` from every dashboard permission check and replacing them
with real Django `Group` membership — `is_staff` now stays reserved for
actual Django-admin-site access, never dashboard access.

- **Three groups** (`owner`/`emp`/`customer`), created + backfilled by
  `accounts/migrations/0008_create_role_groups.py` (existing
  `Employee`-linked users → `emp`, everyone else → `customer`,
  superusers untouched).
- **Assignment is automatic, never self-service**: `accounts/adapter.py`
  (new) — `AccountAdapter.save_user()` adds `customer` on self-signup
  (covers social signup too, since `DefaultSocialAccountAdapter.save_user()`
  calls into the same account adapter method);
  `core/admin_dashboard_views.py::_create_employee_login()` adds `emp`
  when an owner creates a beautician login. `owner` is **only** ever
  granted from the Django admin site by a superuser — no code path
  grants it.
- **`core/decorators.py`** (new) — `is_owner`/`is_emp` predicates,
  `@owner_required`/`@owner_or_emp_required` view decorators, replacing
  every prior `is_staff`/`employee_profile` check across
  `core/admin_dashboard_views.py` and `core/employee_dashboard_views.py`.
- **`core/middleware.py`** (new) — `RoleRedirectMiddleware`, registered
  after `AuthenticationMiddleware`/`AccountMiddleware`: owner → redirected
  off the marketing page straight to `/dashboard/`, emp → `/employee/`,
  customer → normal marketing/booking access. `ALWAYS_ALLOWED_PREFIXES`
  (`/dashboard/`, `/employee/`, `/accounts/`, `/admin/`, `/static/`,
  `/media/`, `/api/`) exempts the pages a role redirect would otherwise
  loop against.
- **`AccountAdapter.get_login_redirect_url()`** sends each role to its
  landing page right after login, same role→URL mapping as the
  middleware.
- **`core/context_processors.py::user_roles()`** exposes
  `is_owner`/`is_emp`/`user_role_label` globally — used by
  `templates/booking/components/profile_dropdown.html` to show the
  account's actual role instead of a generic "Signed in".

Verified: `sachinshah` (now `emp`-only, `is_staff=False`) can reach
`/employee/` and is correctly blocked from `/dashboard/`; a fresh
self-signup lands in `customer` and gets the marketing/booking flow; an
owner-created beautician login lands in `emp` and redirects straight to
`/employee/` on login.

## Admin dashboard UI polish + Category.icon removed (added 2026-08-08)

A run of small, mid-session UI requests, tracked and applied without
dropping the larger work in progress:

- Compressed `admin-table` row height/padding, `admin-service-card`
  vertical height, and the services toolbar (search/filter/sort) from a
  sprawling multi-row layout down to two rows (`admin-toolbar__row`/
  `admin-toolbar__actions` added to `static/css/admin_dashboard.css`).
- **`Category.icon` removed entirely** — model field, `catalog/admin.py`,
  `core/admin_dashboard_views.py`'s add/edit-category handling,
  `core/booking_data.py::get_booking_categories()`, `api/views.py::
  get_categories()`, and the categories-list admin template all dropped
  every icon/emoji reference. Migration:
  `catalog/migrations/0008_remove_category_icon.py`.
- Added an "Employee Dashboard" link to the owner sidebar
  (`templates/admin_dashboard/layouts/admin_base.html`) — previously
  there was no way for an owner to reach their own employee-facing view
  without typing the URL directly.

## Services vs. Packages: UI split, then the real model split (added 2026-08-08)

Two distinct pieces of work, prompted by a direct client question
midway through ("have you actually created separate tables for these?")
that the first pass had honestly not done yet.

**Pass 1 — UI-only.** The admin Services page (one list behind an
All/Services/Packages filter tab) became two pages/URLs
(`/dashboard/services/`, `/dashboard/packages/`), each locked to one
`kind` — but still backed by the **same** `Service` table with a `kind`
discriminator column, same as before. `_handle_catalog_post_action`
(shared add/edit/delete/variant logic) and `_dashboard_catalog_list`
(shared kind-locked GET listing) were extracted in
`core/admin_dashboard_views.py` to avoid duplicating that logic across
the two new view functions.

**Pass 2 — the real split**, once asked to actually do it:
`catalog/models.py` gained an abstract `CatalogItemBase` (slug, name,
description, photo fields, tone, rating, reviews_count,
popularity_score, badges, available_today, is_active, timestamps —
everything `Service` and `Package` share) and an abstract `VariantBase`
(label, duration_mins, price, mrp, is_default, is_active, sort_order).
`Service`/`Package` became separate concrete models/tables (each with
its own `category` FK and `related_name`), `ServiceVariant`/
`PackageVariant` likewise separate, `Package.included_services` an M2M
to `Service` only (never to another `Package`).

- **Four sequential migrations** (`catalog.0009` create Package/
  PackageVariant → `bookings.0012` add `BookingItem.package_variant`/
  `Review.package` nullable FKs + make `Review.service` nullable →
  `bookings.0013` **data migration**: move every real `kind='package'`
  row into the new tables (variant, `included_services` M2M,
  `BookingItem`/`Review` FK rewrites), then delete the old row →
  `catalog.0010` remove `Service.kind`/`included_services`. Dependency
  ordering had to be hand-corrected once (Django auto-generated a
  dependency on the not-yet-written removal migration).
- **`auto_now_add`/`auto_now` gotcha**: the data migration's
  `Package.objects.create(...)` would force `created_at`/`updated_at` to
  migration-run-time regardless of the value passed — fixed by following
  `.create()` with a `.filter(pk=...).update(created_at=..., updated_at=...)`,
  which bypasses both.
- **Every consumer updated for two real models**: `bookings/views.py`'s
  `_resolve_cart_pricing`/`create_booking`/`submit_review`/rebook logic,
  `core/booking_data.py`'s catalog-building (`Service` and `Package`
  queried separately, merge-sorted by `created_at` — no longer `id`,
  since the two now have independent PK sequences), `core/views.py::
  service_detail` (tries `Service` first, falls back to `Package`),
  `core/admin_dashboard_views.py`'s services/packages dashboard views,
  and `accounts/views.py::delete_account`'s review-cascade rating
  recompute (now handles `Review.package_id` alongside
  `Review.service_id`).
- **Backed up `db.sqlite3` before running any of it** against real data
  — same discipline as every other schema-altering migration this
  project has run.

Verified end-to-end afterward: catalog JSON (merged service+package
list), both detail pages, admin CRUD for both models, checkout with a
cart containing one of each, review submission, rebook, and account
deletion's rating recompute.

## PackageVariant removed — a package prices itself directly (added 2026-08-08)

Raised as a direct question ("do we really need a PackageVariant?") and
confirmed: unlike a `Service` (which legitimately needs several price/
duration options — different wax types, durations), a `Package` only
ever has **one** sellable price in practice. A `PackageVariant` table
that could hold at most one real row per package was pure overhead, so
it was removed and `Package` gained `price`/`mrp`/`duration_mins` fields
directly, plus `discount_pct`/`duration_label` properties mirroring
`VariantBase`'s (deliberately same names/shapes, so call sites that
resolve "the priced thing" for an item use a `ServiceVariant` for a
`Service` and the `Package` instance itself for a `Package`, with no
special-casing needed downstream).

- **Seven-migration sequence**: `catalog.0011` add nullable
  `price`/`mrp`/`duration_mins` to `Package` → `bookings.0014` add
  nullable `BookingItem.package` (FK straight to `catalog.Package`,
  replacing the old `package_variant` FK) → `bookings.0015` **data
  migration** copying every `BookingItem.package_variant.package_id`
  onto the new field → `bookings.0016` drop the old
  `package_variant` field → `catalog.0012` **data migration**
  backfilling each `Package`'s `price`/`mrp`/`duration_mins` from its
  existing default `PackageVariant` → `catalog.0013` make `price`/
  `duration_mins` non-nullable → `catalog.0014` delete the
  `PackageVariant` model. Ordering matters both directions: `Package`'s
  own fields must be backfilled before being made non-nullable, and
  `PackageVariant` can't be dropped until nothing (the old
  `BookingItem.package_variant` FK) still points at it.
- **`bookings/views.py`, `core/booking_data.py`, `core/views.py`,
  `core/admin_dashboard_views.py` updated**: anywhere that used to do
  `package.default_variant.price` now either reads `package.price`
  directly or (in the two admin/booking views that resolve "the priced
  thing" generically for either a `Service` or `Package`) sets a local
  `variant = item if is_package else item.default_variant` — a plain
  Python variable, not a fake model property — so downstream code
  reading `variant.price`/`.discount_pct` doesn't need to know which
  kind it got.
- **`core/admin_dashboard_views.py`'s `add_service`/`edit_service`**
  actions split into clean per-kind branches — a package's add/edit
  parses a single scalar `price`/`mrp`/`duration_mins` from the POST
  body directly, no longer a list of "variant rows" with only the first
  row actually used.
- **Real data-loss incident during this work** (worth recording as
  context, not a code change): the project's one real `Package` row and
  its `package` `Category` were deleted from the live database mid-work
  via the admin dashboard — traced precisely (only those two rows
  gone, everything else — 38 services, 65 variants, both real bookings —
  untouched) and confirmed with the client to be an intentional delete,
  not corruption, so nothing was restored from the pre-migration backup.
  Later verification in this same block of work used a freshly created,
  then cleaned-up, test package instead of the original.

## Dedicated Package add/edit form, split from Service's (added 2026-08-08)

`templates/admin_dashboard/services_list.html` had, since the Pass-1 UI
split above, used **one shared modal** (`addServiceModal`/
`editServiceModal`) for both Services and Packages, with JS
(`toggleKindFields()`) showing/hiding fields based on `locked_kind` —
harmless while both kinds still saved through the same "variant rows"
shape, but left over and increasingly inaccurate once `PackageVariant`
was removed above (the modal still labeled its one price row a
"variant", still had "Add Another Variant" logic to hide for packages).

- **`services_list.html`** trimmed to Service-only — no more
  `locked_kind` branching anywhere in the template, multi-variant Add/
  Edit modals and the separate Add/Edit Variant modals unchanged.
- **`packages_list.html`** (new) — its own Add/Edit Package modal with
  plain `price`/`mrp`/`duration_mins` fields (matching `Package`'s own
  field names, no "variant" wording), the included-services checklist
  with live MRP/duration auto-calc kept as-is, and no "Add Another
  Variant" control at all.
- **New capability, not just a rename**: Edit Package now lets you
  change price/mrp/duration directly. The old shared modal's Edit path
  never had anywhere clean to put that for a package (only Add did,
  via the first "variant row") — a genuine gap in the old form, now
  fixed rather than carried over.
- `core/admin_dashboard_views.py::dashboard_packages` points at the new
  template; `_handle_catalog_post_action`'s `add_service`/`edit_service`
  package branches read the new scalar field names directly.

## Two demo packages added, then all bridal content removed (added 2026-08-08)

Two real packages were created through the actual admin flow (not
raw DB inserts) to exercise the new form end-to-end — "Arms & Legs Wax
Combo" (body-wax) and "Bridal Glow Facial & Threading Combo" (premium-
facial, built around the catalog's existing "O3 Bridal Facial (Vitamin
C)" service) — both with real included services and admin-auto-
calculated MRP/duration.

The client then clarified: **the business doesn't do bridal makeup or
anything bridal-branded at all.** Removed, rather than renamed, since
neither had any real bookings or reviews attached (confirmed before
deleting):

- The real `Service` "O3 Bridal Facial (Vitamin C)" and the "Bridal Glow
  Facial & Threading Combo" `Package` built on it.
- Every bridal reference in marketing mock content, none of it real
  catalog data but all of it user-facing copy that misrepresented what
  the business actually offers: `core/mock_data.py`'s featured-service
  entry (replaced with a real non-bridal facial), a beautician's
  specialty+skills (`Bridal Makeup Artist` → `Waxing & Threading
  Specialist`), a testimonial's quote+service, a before/after gallery
  entry (removed outright rather than relabeled — no non-bridal photo
  existed to swap in, and relabeling an actual bridal photo would still
  be misleading), a portfolio item's label (its photo was already reused
  elsewhere for "packages" generally, so relabeling it was safe), and a
  beauty-tip article; `core/booking_data.py::get_trending_searches()`'s
  "Bridal Makeup" entry; the SEO `<meta keywords>` tag; the contact
  form's example placeholder; the admin package-form's example
  placeholder; and the Flutter mobile app's (`mobile_app/lib/main.dart`)
  "Bridal & Makeup" category card.

Verified: a full source-tree grep for "bridal" (excluding build
artifacts) returns nothing, `manage.py check` passes, and the landing
page's rendered HTML contains no bridal references.

## Postgres for the server, SQLite locally; mock_data.py fully retired; Cloudinary for images (added 2026-08-11)

Prompted by real credentials landing in `.env` — a Postgres server DB
and (mid-task) Cloudinary. Three changes, done together since they all
touch the same "where does persisted content actually live" question.

**Database becomes per-environment.** `GlamourAtHome/settings.py`'s
`DATABASES` now branches on `DB_HOST`: set → Postgres (`DB_NAME`/
`DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD` from `.env`), unset →
SQLite (unchanged default). This was chosen deliberately over a
DEBUG-based or always-SQLite-locally switch: as soon as real Postgres
creds exist in a `.env`, that same checkout talks to Postgres
immediately, including locally — there's no separate override once the
creds are present, so an environment that shouldn't be a shared DB's
neighbor simply shouldn't have those creds in its `.env`. Added
`psycopg2-binary` to `requirements.txt`. **First connection attempt
failed** — `password authentication failed for user "vindhyatech"` —
not a network/firewall issue (the driver reached the server fine), so
this was reported back rather than guessed around; a `.env` fix (the
real var names turned out to be `DB_USER`/`DB_PORT`, not the
`DB_USERNAME`/`PORT` first assumed from an earlier, since-corrected
read of the file) resolved it.

**Every marketing-page mock function became a real model.** The
landing page's decorative content (hero, value pillars, how-it-works,
trust points/badges, beauticians, testimonials, gallery, beauty tips,
FAQs) and the booking app's notification-bell/trending-search content
were, until now, hardcoded Python dicts in `core/mock_data.py` — the
last piece of "everything real except this" left in the project. 13
new models in `core/models.py`, one per section, deliberately keeping
every field name the templates already read (`pillar.index`,
`step.step`, `n.time_label`, etc.) so most templates needed zero
changes. `SiteImageMixin` (this app's own copy of `catalog.
CatalogItemBase`'s photo/photo_image/photo_url/`display_photo_url`
pattern — not shared cross-app, since no cross-app base exists to hang
it off) backs every model with a real photo. Two migrations: `core.
0001_initial` (schema) and `core.0002_seed_site_content` (a data
migration seeding every value `mock_data.py` used to hardcode — the
actual "migrate the data" step, not just a schema move). `core/views.
py::index()` and `core/booking_data.py::get_notifications_mock()`/
`get_trending_searches()` now query these models directly;
`core/mock_data.py` was deleted outright once nothing imported it
anymore. One dead code path found and dropped along the way:
`get_featured_services()`/the `featured_services` context key were
passed into `featured_services.html` but that template never actually
read them (it renders the real catalog categories instead) — not
migrated to a model since migrating unused content would just be
new dead code with extra steps.

Two template patterns needed real edits, not just a data-source swap:
`hero.primary_cta.href`/`.label` (a nested-dict lookup that only worked
because the old mock value was a literal dict) became flat
`hero.primary_cta_href`/`.primary_cta_label` fields; every
`{% static x.photo %}` tag (works only for a bare relative path) became
`{{ x.display_photo_url }}` (a real resolved URL, required once photos
can be uploads or external links, not just static assets) —
`hero.html`, `beauticians.html`, `gallery.html` (before **and** after,
plus the portfolio grid), `beauty_tips.html`.

**Cloudinary for all image uploads** (mid-task addition, once those
creds landed in `.env` too — superseding the original "keep images
local for now" plan). `django-cloudinary-storage` + `cloudinary` added
to `requirements.txt`; Django's `STORAGES['default']` now points at
`cloudinary_storage.storage.MediaCloudinaryStorage`, configured from
`CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`
(`STORAGES['staticfiles']` stays local — this only affects user
uploads, never code-shipped static assets). Verified with a real
upload/fetch/delete round-trip against the live Cloudinary account
before trusting it with real data. Of the 13 files sitting in the old
local `media/` folder, only 4 were still actually referenced by a real
DB row (four `Category.image` uploads — the rest were orphaned test
uploads from earlier sessions) — those 4 were re-saved through their
model field so Django's storage API re-uploaded them to Cloudinary and
rewrote the DB path; the orphaned local files were left alone (not
deleted — harmless, and deleting unreferenced files wasn't asked for).

**Copying real data from SQLite to the new Postgres DB.** `migrate` on
a fresh Postgres DB necessarily reruns every `RunPython`/`RunSQL` seed
migration (`catalog.0002_seed_catalog`, `accounts.0008_create_role_
groups`, `bookings.0011_seed_offers`, `core.0002_seed_site_content`),
which would collide with a straight `dumpdata`/`loaddata` copy of the
real SQLite data on top. Fixed by `TRUNCATE ... RESTART IDENTITY
CASCADE` on every real app table right after `migrate` (before loading
anything), giving Postgres a genuinely clean slate; then `dumpdata
--natural-foreign --natural-primary` (excluding `contenttypes`/`auth.
permission`/`sessions.session`/`admin.logentry`, Django's own
regenerated-not-transferred tables) from SQLite, `loaddata` into
Postgres, then `manage.py sqlsequencereset` — `loaddata` inserts
explicit PKs without advancing Postgres's sequences, so skipping this
would make the next INSERT collide with an existing row. Verified: a
per-model row-count comparison between SQLite and Postgres matched
exactly for every app (`catalog`/`bookings`/`accounts`/`core`, plus
`auth.User`/`Group`), and a fresh `Category.objects.create()` after
the reset landed on a correct, non-colliding next id.

## Real transactional email via Brevo (added 2026-08-11)

`EMAIL_BACKEND` was the console backend (emails just printed to the
runserver log) — every allauth email (password reset, optional
verification) was silently going nowhere real. Switched to `django-
anymail`'s Brevo backend (`anymail.backends.brevo.EmailBackend`),
configured from `BREVO_API_KEY`/`DEFAULT_FROM_EMAIL` in `.env`. Falls
back to the console backend when no key is configured (a local
checkout with no `.env` secrets doesn't need real email to run) — same
"reserved slot, works once filled in" pattern as every other
credential-gated integration in this project (Google Maps, Razorpay,
Google/Apple OAuth). No application code sends email directly yet
(grepped — zero `send_mail`/`EmailMessage` call sites outside
allauth's own internals), so this change is purely "make the existing
allauth emails actually deliver," not new email-sending functionality.
Verified with a real self-addressed `send_mail()` call — Brevo
accepted it (`send_mail` returned 1, no exception) — before trusting it
with real password-reset traffic.

## Beautician merged into Employee — the "meet the team" carousel now shows real staff (added 2026-08-11)

`core.Beautician` (added earlier the same day, as part of moving
`mock_data.py` off the landing page) was decorative content — four
fictional profiles unrelated to any real employee. Asked directly why
two models existed for what's conceptually one person, and then to
combine them: `core.Beautician` is deleted; `accounts.Employee` gained
`slug`/`reviews`/`skills`/`sort_order`/`photo_image`/`photo_url` (plus
a `display_photo_url` property, same upload-wins-over-url-wins-over-
static-fallback pattern used throughout the project) so the one real
staff model now also backs the public carousel. `specialties`/
`experience_years`/`rating` already existed on `Employee` for
operational use and needed no new fields — the template was updated to
read those instead of `specialty`/`experience`/a separate `rating`
duplicate. `core/views.py::index()`'s `beauticians` context now queries
`Employee.objects.filter(status='active')` — only active staff are
advertised publicly; on_leave/inactive employees keep their record
without appearing on the homepage.

`slug` needed the careful nullable → backfill → non-null migration
sequence (same pattern as `Package.price` earlier) since it's
`unique=True` and one real row already existed: `accounts.0009` adds it
nullable, `0010` backfills every existing employee via the same
"lowercase, collision-suffixed" scheme every other model's slug uses
(reimplemented inline in the migration, not imported, so it can't break
if the app-code version changes later), `0011` makes it required.
`core/admin_dashboard_views.py`'s `add_employee` action — the real
creation path, not just the migration's one-time backfill — was updated
to call `generate_unique_slug(Employee, name)`, otherwise a second
employee would have hit the unique constraint immediately. Verified:
the real employee ("sachin shah") now renders on the live landing page
with real specialties/experience; creating a same-named second employee
through the actual dashboard form correctly got a collision-suffixed
slug (`sachin-shah-2`); applied to both SQLite and the Postgres server
DB.

## Global AJAX Loading Spinner & Toast Feedback Module (added 2026-08-12)

Every AJAX form submission previously either had custom inline loading logic, silenced failures, or relied on raw native page submits. Added a shared vanilla JS feedback library (`static/js/glamour_feedback.js`) exposing `window.GlamourFeedback`:
- `showLoading(title)`: Renders a blocking, full-screen dark backdrop overlay with a brand-gold (`#c9a15a`) CSS spinner ring and status text. Non-dismissible by clicking outside.
- `hideLoading()`: Collapses the loading overlay.
- `showSuccess(title, text, timerMs)`: Displays an auto-dismissing green toast banner with an animated progress bar shrinking over `timerMs`.
- `showError(title, text)`: Displays a persistent red toast banner with an `✕` dismiss button.

Zero external dependencies (no SweetAlert2 or npm packages required). Styles are injected into `<head>` dynamically on first invocation. Included across all base templates: `templates/base.html`, `templates/admin_dashboard/layouts/admin_base.html`, `templates/employee_dashboard/emp_dashboard.html`, and `templates/employee_dashboard/emp_profile.html`.

Wired into every fetch and AJAX interaction across the application:
1. **Employee Dashboard**: `submitEmpForm` (all tab forms), verification arrival photo upload, and profile camera face-photo upload.
2. **Admin Dashboard**: Bookings status/beautician update handler, schedule calendar navigation (`loadScheduleViaAjax`), and converted the Assign Beautician modal (`#assignModal`) in `overview.html` from a full native POST to an AJAX fetch with instant schedule wrapper re-rendering.
3. **Public Booking App**: Booking drawer address creation, Razorpay order initialization, final booking confirmation checkout, profile address save & delete, and My Bookings review feedback submission.

## Employee Absences & Breaks: Pagination & Type-Aware Overlap Protection (added 2026-08-12)

Enhanced employee leave & short break management on the Beautician Dashboard (`/employee/`):
- **Pagination**: Paginated **My Absences & Breaks History** to 10 items per page using Django's `Paginator` in `core/employee_dashboard_views.py`. Added `Page X of Y` indicator and `← Previous` / `Next →` navigation controls in `templates/employee_dashboard/emp_dashboard.html` preserving owner preview query parameters (`?emp_id=`).
- **Feedback Clean-Up**: Removed duplicate Django `messages.success` notifications on leave creation and deletion so only the unified `GlamourFeedback` **"Saved ✓"** toast notification displays on submission.
- **Type-Aware Overlap Validation**: Updated leave creation logic in `employee_dashboard_views.py` to prevent duplicate or conflicting entries:
  - **Full-Day / Multi-Day Leaves**: Checks date range intersection (`start_date <= new_end AND end_date >= new_start`) against all existing leaves.
  - **Short Intra-Day Breaks**: Checks if a full-day leave already exists for that date, or if another `short_break` on the same date has an intersecting time window (`start_time < new_end AND end_time > new_start`). Multiple non-overlapping short breaks on the same day (e.g. 1 PM–2 PM and 3 PM–4 PM) are explicitly allowed.

## Single Home Page Unification (added 2026-08-12)

Unified the home navigation across desktop and mobile views so that the main marketing landing page (`/`, `views.index`) serves as the single Home page throughout the application:
- **Bottom Navigation Bar (`templates/booking/components/bottom_nav.html`)**: Updated the "Home" navigation item to point to `{% url 'index' %}` (`/`).
- **Header & App Navbar Logo (`templates/booking/components/app_navbar.html` & `templates/partials/navbar.html`)**: Updated the brand logo (`Elix`) link to point to `{% url 'index' %}` (`/`).
- **Auth Shell & Navigation**: Updated the "Back to Elix" link in `templates/allauth/layouts/base.html`, login/logout redirects in `accounts/phone_login_views.py` and `templates/booking/components/profile_dropdown.html`, view-site links in `templates/admin_dashboard/layouts/admin_base.html`, and access-denied fallback redirects in `core/decorators.py` and `core/employee_dashboard_views.py` to point to `index` (`/`).
- **Cleaned redundant button**: Removed the `.app-navbar__back` ("Back to Website") button from `templates/booking/components/app_navbar.html` since both the brand logo and the mobile Home button now navigate directly to the main site Home page (`/`).

## Icon Buttons Soft Light Surface Styling (added 2026-08-12)

Updated header and floating action icon buttons to use clean **Soft Light Surface** styling (`background: var(--surface-2)`, `border: 1px solid var(--border-hairline)`, and `color: var(--text-body)`):
- **Header Avatar (`.app-navbar__avatar`)**: Replaced the solid purple/blue gradient fill with a clean white/surface background and crisp border.
- **Header Action Icons (`.app-navbar__icon-btn`)**: Explicitly styled with `--surface-2` background and subtle shadow.
- **Floating Chat FAB (`.chat-fab`) & Floating Cart Bubble (`.floating-cart__bubble`)**: Changed background from purple gradient to `--surface-2` white surface with hair-line outline border and dark icon contrast, matching header action icons.

## Mobile Bottom Navigation & Profile Dropdown Fix (added 2026-08-13)

- **Bottom Navigation Bar (`templates/booking/components/bottom_nav.html`)**: Replaced the "Bookings" tab with a "Services" tab (`{% url 'services_booking' %}`) featuring a 4-square grid icon.
- **Profile Dropdown (`templates/booking/components/profile_dropdown.html`)**: Updated the "Bookings" menu item to "My Bookings" (`{% url 'bookings_dashboard' %}`), consolidating booking history management into the profile menu.
- **Mobile Dropdown Trigger Fix (`static/css/booking.css` & `static/js/booking.js`)**: Fixed the CSS rule `.app-navbar__dropdown-panel.is-open` and updated mobile `#profile-panel` positioning (`bottom: calc(4.5rem + env(safe-area-inset-bottom))`, `z-index: 1000`, `opacity: 1`, `visibility: visible`) so tapping the Profile tab in the bottom nav smoothly pops up the profile panel directly above the bottom bar.
- **Active Navigation Tracking (`static/js/booking.js`)**: Added `updateBottomNavActiveState()` to dynamically highlight the active bottom nav item (Home, Services, or Profile) based on the current URL path.
- **Mobile Notifications Dropdown Overflow Fix (`static/css/booking.css` & `static/css/components.css`)**: Updated `#notifications-panel` on mobile (`position: fixed`, `top: 4.25rem`, `right: var(--space-sm)`, `width: min(22rem, calc(100vw - 2 * var(--space-sm)))`, `max-height: calc(80vh - 4rem)`) so the panel pops up directly under the header without spilling off the right edge of the screen. Fixed `.btn-icon:hover` and `.app-navbar__icon-btn:hover` to keep a light surface background (`var(--surface-2)` / `var(--surface-3)`) when clicked/hovered instead of turning dark navy.

