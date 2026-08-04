# developed.md — project brain

Read this first. It's written so an agent (or a new dev) can get full context
in one pass without re-reading every file. Update it whenever architecture,
data flow, or scope changes.

## What this is

A premium, single-page marketing/landing site for **Glamour At Home**, an
on-demand home beauty service (verified beauticians + premium products,
delivered to the customer's home). Built with **Django templates only** —
no React/Vue, no frontend build step. Goal of this phase is explicitly
**not booking** — it's brand trust, lead capture (contact form), and app
installs. Every dynamic-looking section is architected to later swap its
data source for a REST API without touching HTML structure.

A second, structurally distinct page now exists alongside it:
**`/services-booking/`**, the actual booking application (catalog browsing +
cart, Phase 1 of 3 — see "Service Booking App" further down). Everything in
this section and up through "Placeholders" below describes the marketing
page only; don't assume it applies to the booking app.

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
  `lng` come from a Leaflet map click; there's no reverse-geocoding (no key
  for that either), so the customer still types the address line manually
  — the pin is just a visual/lat-lng convenience, not parsed into the text.
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

