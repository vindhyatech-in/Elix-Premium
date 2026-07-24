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
over the "no template-looking sections" requirement and keeps `pip install
&& runserver` as the only setup step. If this project later adopts a JS
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
GlamourAtHome/settings.py   INSTALLED_APPS=['core'], TEMPLATES DIRS=[BASE_DIR/'templates'],
                            STATICFILES_DIRS=[BASE_DIR/'static'], SITE_* constants (brand info)
GlamourAtHome/urls.py       includes core.urls at '/', serves static in DEBUG

core/
  mock_data.py              *** THE FILE TO EDIT FOR CONTENT CHANGES ***
                             One get_*() function per section. Each docstring
                             names the future REST endpoint it stands in for.
  views.py                  index() builds one big context dict from mock_data.
                             robots_txt() / sitemap_xml() are hand-rolled views
                             (no django.contrib.sitemaps — single page, not worth it
                             yet; revisit if blog/beautician detail pages are added).
  context_processors.py     site_meta() — injects `SITE` (name/phone/email/social/
                             app links) into every template from settings.py constants.
  templatetags/glamour_extras.py   `times` filter — {% for _ in n|times %} to repeat
                             a block n times (used for star ratings, QR mock grid).
  urls.py                   '', 'robots.txt', 'sitemap.xml'

templates/
  base.html                 <head> via partials/meta.html, preloader, navbar, {% block
                             content %}, footer, JSON-LD schema, then vendor CDN <script>
                             tags (gsap, ScrollTrigger, aos, swiper, lenis) + main.js/animations.js
  index.html                extends base.html; includes all 13 components in order,
                             passing each its slice of context by name
  sitemap.xml                template rendered by views.sitemap_xml
  partials/                  meta.html (SEO/OG/Twitter/fonts), navbar.html, footer.html,
                             preloader.html, schema.html (LocalBusiness + FAQPage JSON-LD)
  components/                 one file per section — see "Section map" below

static/
  css/  variables.css (design tokens) → base.css (reset/typography/a11y) →
        components.css (buttons/chips/nav/cards/forms/footer) →
        sections.css (bespoke per-section layout — the bulk of the visual design) →
        animations.css (preloader/cursor-glow keyframes) →
        responsive.css (breakpoint overrides not already mobile-first inline)
        all pulled together by main.css via @import
  js/   main.js        library bootstrapping: preloader, Lenis+ScrollTrigger wiring,
                        navbar scroll/burger state, AOS.init, Swiper instances,
                        service category filter, FAQ accordion, contact/newsletter
                        form handlers (simulated success — no backend yet), cursor glow
        animations.js   bespoke motion: hero canvas orb background, hero headline
                        GSAP reveal, count-up stats (IntersectionObserver + GSAP),
                        "why us" sticky-frame swap (IntersectionObserver), how-it-works
                        scroll-scrubbed line (ScrollTrigger), before/after drag sliders,
                        subtle card tilt on hover
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

| # | Section | Template | Context var(s) | Mock data source |
|---|---|---|---|---|
| 1 | Hero | `components/hero.html` | `hero` | `get_hero()` |
| 2 | Why Glamour At Home | `components/why_us.html` | `value_pillars` (as `pillars`) | `get_value_pillars()` |
| 3 | Featured Services | `components/featured_services.html` | `service_categories`, `featured_services` | `get_service_categories()`, `get_featured_services()` |
| 4 | Beauty Packages | `components/packages.html` | `packages` | `get_packages()` |
| 5 | How It Works | `components/how_it_works.html` | `how_it_works` (as `steps`) | `get_how_it_works()` |
| 6 | Why Customers Trust Us | `components/trust.html` | `trust_points`, `trust_badges` | `get_trust_points()`, `get_trust_badges()` |
| 7 | Meet Our Beauticians | `components/beauticians.html` | `beauticians` (as `artists`) | `get_beauticians()` |
| 8 | Customer Stories | `components/testimonials.html` | `testimonials` (as `stories`) | `get_testimonials()` |
| 9 | Gallery | `components/gallery.html` | `gallery` | `get_gallery()` |
| 10 | Beauty Tips | `components/beauty_tips.html` | `beauty_tips` (as `tips`) | `get_beauty_tips()` |
| 11 | Download App | `components/download_app.html` | (uses global `SITE.apps`) | — |
| 12 | FAQs | `components/faqs.html` | `faqs` | `get_faqs()` |
| 13 | Contact | `components/contact.html` | (uses global `SITE`) | — |
| 14 | Footer | `partials/footer.html` | (uses global `SITE`) | — |

Each section root element has a `data-api="/api/v1/..."` attribute matching
its mock function's docstring — grep for `data-api` to find every future
integration point in one pass.

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

- **Palette** (`static/css/variables.css`): warm espresso ink (`--ink
  #16120f`) + ivory (`--cream #faf6ef`) + champagne gold (`--gold #c9a15a`)
  + blush (`--blush #e9c8c2`). Gold = trust/luxury accent, used sparingly
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
  interactive widgets (accordion, filters, carousels), `prefers-reduced-
  motion` disables/shortens all custom JS animation (canvas, GSAP, counters)
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

## Current state vs. future work (explicitly out of scope this phase)

- No booking flow, no user auth, no payment integration — by design (see
  project goal at the top of this file).
- No Django models/migrations beyond the framework defaults — all content
  is Python dicts in `mock_data.py`. Don't add models speculatively; add
  them when the real API/admin-editable-content work actually starts.
- No DRF app scaffolded yet (`djangorestframework` is commented out in
  `requirements.txt`) — uncomment and `pip install` when that work begins.
