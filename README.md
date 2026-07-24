# Glamour At Home — Landing Page

A premium, animated, single-page marketing site for an on-demand home beauty
service, built with Django templates (no frontend build step required).

For architecture, data flow, and where to plug in a real API, read
**[developed.md](developed.md)** — it's written as a fast-onboarding brief
for whoever (human or agent) picks this project up next.

## Quick start

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

python manage.py migrate        # sets up the default Django tables (auth/admin)
python manage.py runserver
```

Visit `http://127.0.0.1:8000/`.

No `npm install` or build step is needed — Tailwind is intentionally *not*
used; GSAP, AOS, Swiper and Lenis are loaded via CDN `<script>` tags in
[templates/base.html](templates/base.html), and all page styling is a
hand-authored CSS design system in `static/css/`.

## Project layout

```
core/                   Django app: views, URL routes, mock "API" data
  mock_data.py          Every section's content — swap for real API calls later
  views.py              index / robots.txt / sitemap.xml
  context_processors.py Site-wide brand data (name, phone, socials, app links)
templates/
  base.html             <head>, preloader, nav, footer, vendor <script> tags
  index.html            Assembles all 13 sections in order
  partials/              nav, footer, meta tags, JSON-LD schema, preloader
  components/            One template per landing-page section
static/
  css/                  variables -> base -> components -> sections -> animations -> responsive
  js/                   main.js (library init/UI wiring), animations.js (bespoke motion)
  images/               favicon.svg, og-cover.svg (placeholders — swap for real photography)
```

## Notes

- `DEBUG = True` and the default `SECRET_KEY` are dev-only — replace both
  before deploying, and set `ALLOWED_HOSTS`.
- No models/migrations exist yet beyond Django's built-ins — this is a
  static-content marketing page by design (see developed.md "Current state
  vs. future work").
