/**
 * main.js — library bootstrapping & core UI wiring.
 * Scroll-triggered / canvas / drag animations live in animations.js;
 * this file owns: preloader, smooth scroll, nav, carousels, forms, accordion.
 */
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------------------------------------------------------
   * Preloader
   * ------------------------------------------------------- */
  function initPreloader() {
    const preloader = document.getElementById('preloader');
    if (!preloader) return;
    const fill = preloader.querySelector('.preloader__bar-fill');

    requestAnimationFrame(() => { if (fill) fill.style.width = '100%'; });

    window.addEventListener('load', () => {
      setTimeout(() => {
        preloader.classList.add('is-hidden');
        document.body.classList.add('is-loaded');
        window.dispatchEvent(new CustomEvent('glamour:loaded'));
      }, 500);
    });

    // Safety net: never trap the user behind the preloader.
    setTimeout(() => preloader.classList.add('is-hidden'), 4000);
  }

  /* ---------------------------------------------------------
   * Lenis smooth scroll, wired into GSAP ScrollTrigger's ticker
   * ------------------------------------------------------- */
  function initSmoothScroll() {
    if (prefersReducedMotion || typeof Lenis === 'undefined') return null;

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });

    if (window.gsap && window.ScrollTrigger) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
      requestAnimationFrame(raf);
    }
    return lenis;
  }

  /* ---------------------------------------------------------
   * Navbar: scrolled state + mobile drawer
   * ------------------------------------------------------- */
  function initNavbar() {
    const navbar = document.getElementById('navbar');
    const burger = document.getElementById('burger');
    const drawer = document.getElementById('mobile-drawer');
    const drawerClose = document.getElementById('drawer-close');
    const backdrop = document.getElementById('drawer-backdrop');
    if (!navbar) return;

    const onScroll = () => navbar.classList.toggle('is-scrolled', window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (burger && drawer) {
      const closeDrawer = () => {
        drawer.classList.remove('is-open');
        if (backdrop) backdrop.classList.remove('is-open');
        burger.classList.remove('is-active');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        if (window.__lenis) window.__lenis.start();
      };

      const openDrawer = () => {
        drawer.classList.add('is-open');
        if (backdrop) backdrop.classList.add('is-open');
        burger.classList.add('is-active');
        burger.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
        if (window.__lenis) window.__lenis.stop();
      };

      burger.addEventListener('click', () => {
        const isOpen = drawer.classList.contains('is-open');
        if (isOpen) closeDrawer();
        else openDrawer();
      });

      if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
      if (backdrop) backdrop.addEventListener('click', closeDrawer);

      drawer.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', (e) => {
          closeDrawer();
          const href = link.getAttribute('href');
          if (href && href.startsWith('#')) {
            const target = document.querySelector(href);
            if (target) {
              setTimeout(() => {
                if (window.__lenis) {
                  window.__lenis.scrollTo(target, { offset: -60 });
                } else {
                  target.scrollIntoView({ behavior: 'smooth' });
                }
              }, 100);
            }
          }
        });
      });
    }
  }

  /* ---------------------------------------------------------
   * Theme toggle (light/dark) — data-theme on <html>, persisted to
   * localStorage. The initial value is set by an inline script in
   * base.html's <head> (before CSS paints, to avoid a flash); this just
   * wires up the button(s) and keeps them in sync if there are several
   * (navbar + mobile drawer both have one).
   * ------------------------------------------------------- */
  function initThemeToggle() {
    const toggles = document.querySelectorAll('[data-theme-toggle]');
    if (!toggles.length) return;

    const root = document.documentElement;

    const syncLabels = () => {
      const isDark = root.getAttribute('data-theme') === 'dark';
      toggles.forEach((btn) => {
        btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      });
    };
    syncLabels();

    const applyTheme = (theme) => {
      if (!prefersReducedMotion) {
        root.classList.add('theme-transitioning');
        setTimeout(() => root.classList.remove('theme-transitioning'), 450);
      }
      root.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      syncLabels();
    };

    toggles.forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
      });
    });

    // Follow the OS-level preference live, but only until the visitor makes
    // an explicit choice of their own (once they've clicked a toggle,
    // localStorage holds their pick and this stops overriding it).
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (localStorage.getItem('theme')) return;
        root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        syncLabels();
      });
    }
  }

  /* ---------------------------------------------------------
   * AOS — scroll reveal for section headers/cards
   * ------------------------------------------------------- */
  function initAOS() {
    if (typeof AOS === 'undefined') return;
    AOS.init({
      duration: 700,
      easing: 'ease-out-cubic',
      once: true,
      offset: 60,
      disable: prefersReducedMotion,
    });

    // Web fonts (Fraunces/Inter) and images can finish loading after AOS's
    // initial position calculation, shifting section offsets slightly — a
    // stale calculation can make an element's reveal trigger late/never.
    // Recalculating once everything has actually finished loading keeps
    // trigger points accurate for content further down the page.
    window.addEventListener('load', () => AOS.refresh());
  }

  /* ---------------------------------------------------------
   * Swiper carousels — beauticians & customer stories
   * ------------------------------------------------------- */
  function initCarousels() {
    if (typeof Swiper === 'undefined') return;

    if (document.querySelector('.artists__swiper')) {
      new Swiper('.artists__swiper', {
        slidesPerView: 1.15,
        spaceBetween: 24,
        navigation: { nextEl: '#artists-next', prevEl: '#artists-prev' },
        // forceToAxis: only hijacks wheel/trackpad input when the gesture is
        // mostly horizontal — a plain `mousewheel: true` would also capture
        // vertical scroll intent whenever the cursor sits over the carousel,
        // trapping the page mid-scroll.
        mousewheel: { forceToAxis: true, sensitivity: 1 },
        breakpoints: {
          640: { slidesPerView: 2.1 },
          1024: { slidesPerView: 3.2 },
        },
      });
    }

    if (document.querySelector('.stories__swiper')) {
      new Swiper('.stories__swiper', {
        effect: 'fade',
        fadeEffect: { crossFade: true },
        slidesPerView: 1,
        speed: 600,
        autoplay: prefersReducedMotion ? false : { delay: 5500, disableOnInteraction: false },
        pagination: { el: '.stories__swiper .swiper-pagination', clickable: true },
        navigation: { nextEl: '#stories-next', prevEl: '#stories-prev' },
      });
    }
  }

  /* ---------------------------------------------------------
   * Featured services — client-side category filter
   * (API-ready: when GET /api/v1/services/?category=X exists,
   * replace the class-toggle below with a re-fetch + re-render.)
   * ------------------------------------------------------- */
  function initServiceFilters() {
    const filterBar = document.querySelector('[data-service-filters]');
    const grid = document.querySelector('[data-service-grid]');
    if (!filterBar || !grid) return;

    const cards = grid.querySelectorAll('.service-card');

    filterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;

      filterBar.querySelectorAll('.chip').forEach((chip) => {
        chip.classList.remove('is-active');
        chip.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');

      const category = btn.dataset.filter;
      cards.forEach((card) => {
        const show = category === 'All' || card.dataset.category === category;
        card.classList.toggle('is-hidden', !show);
      });
    });
  }

  /* ---------------------------------------------------------
   * FAQ accordion — single-open, animated height
   * ------------------------------------------------------- */
  function initAccordion() {
    const items = document.querySelectorAll('[data-accordion-item]');
    if (!items.length) return;

    items.forEach((item) => {
      const trigger = item.querySelector('[data-accordion-trigger]');
      const panel = item.querySelector('[data-accordion-panel]');
      const inner = panel.querySelector('.accordion-item__panel-inner');

      trigger.addEventListener('click', () => {
        const willOpen = !item.classList.contains('is-open');

        items.forEach((other) => {
          if (other === item) return;
          other.classList.remove('is-open');
          const otherPanel = other.querySelector('[data-accordion-panel]');
          const otherTrigger = other.querySelector('[data-accordion-trigger]');
          otherPanel.style.height = otherPanel.scrollHeight + 'px';
          requestAnimationFrame(() => { otherPanel.style.height = '0px'; });
          otherTrigger.setAttribute('aria-expanded', 'false');
        });

        if (willOpen) {
          item.classList.add('is-open');
          panel.style.height = inner.offsetHeight + 'px';
          trigger.setAttribute('aria-expanded', 'true');
        } else {
          item.classList.remove('is-open');
          panel.style.height = panel.scrollHeight + 'px';
          requestAnimationFrame(() => { panel.style.height = '0px'; });
          trigger.setAttribute('aria-expanded', 'false');
        }
      });

      panel.addEventListener('transitionend', () => {
        if (item.classList.contains('is-open')) panel.style.height = 'auto';
      });
    });
  }

  /* ---------------------------------------------------------
   * Lead-gen forms (contact + newsletter)
   * No backend yet — simulated success state.
   * Future: POST /api/v1/leads/ and /api/v1/newsletter/
   * ------------------------------------------------------- */
  function initLeadForms() {
    const contactForm = document.querySelector('[data-contact-form]');
    if (contactForm) {
      const status = contactForm.querySelector('[data-contact-status]');
      contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!contactForm.checkValidity()) { contactForm.reportValidity(); return; }
        status.textContent = 'Sending...';
        setTimeout(() => {
          status.textContent = "Thank you! Our concierge team will call you within the hour.";
          contactForm.reset();
        }, 900);
      });
    }

    const newsletterForm = document.querySelector('[data-newsletter-form]');
    if (newsletterForm) {
      const status = newsletterForm.querySelector('[data-newsletter-status]') ||
        newsletterForm.parentElement.querySelector('[data-newsletter-status]');
      newsletterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!newsletterForm.checkValidity()) { newsletterForm.reportValidity(); return; }
        if (status) status.textContent = "You're on the list!";
        newsletterForm.reset();
      });
    }
  }

  /* ---------------------------------------------------------
   * "Book Now" / "Choose <package>" CTAs (Featured Services, Packages) —
   * add the item straight to the Service Booking app's cart and hand off
   * to /services-booking/, instead of just linking to the contact form.
   * Writes the exact same localStorage shape booking.js's cart expects
   * ([{id, qty}] under 'glamour_cart') — the marketing and booking pages
   * are separate bundles (see developed.md), so this is a small, self-
   * contained duplicate of booking.js's addItem() rather than a shared
   * import. Service/package `id`s in mock_data.py were chosen to match
   * core/booking_data.py's catalog ids 1:1, which is what makes this work
   * without a lookup step. The `?open_cart=1` query param on the link
   * (added in the templates) tells booking.js to auto-open the mini-cart
   * on arrival — see its initFloatingCart().
   * ------------------------------------------------------- */
  function initMarketingBookButtons() {
    const buttons = document.querySelectorAll('[data-add-to-booking-cart]');
    if (!buttons.length) return;

    buttons.forEach((link) => {
      link.addEventListener('click', () => {
        const id = link.dataset.catalogId;
        if (!id) return;
        let cart = [];
        try { cart = JSON.parse(localStorage.getItem('glamour_cart')) || []; } catch (e) { cart = []; }
        const line = cart.find((l) => l.id === id);
        if (line) line.qty += 1; else cart.push({ id, qty: 1 });
        localStorage.setItem('glamour_cart', JSON.stringify(cart));
        // No preventDefault — the <a href> navigation to /services-booking/
        // proceeds normally right after this synchronous write.
      });
    });
  }

  /* ---------------------------------------------------------
   * Cursor glow (desktop pointer only)
   * ------------------------------------------------------- */
  function initCursorGlow() {
    const glow = document.getElementById('cursor-glow');
    if (!glow || !isFinePointer || prefersReducedMotion) return;

    window.addEventListener('mousemove', (e) => {
      glow.classList.add('is-active');
      glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    }, { passive: true });
  }

  function initDropdowns() {
    const panels = document.querySelectorAll('[data-dropdown-panel]');
    if (!panels.length) return;

    function closeAll(except) {
      panels.forEach((panel) => {
        if (panel === except) return;
        panel.classList.remove('is-open');
        panel.closest('[data-dropdown]')?.classList.remove('is-open');
        document.querySelectorAll(`[aria-controls="${panel.id}"]`).forEach((t) => t.setAttribute('aria-expanded', 'false'));
      });
    }

    document.querySelectorAll('[data-dropdown]').forEach((dropdown) => {
      dropdown.addEventListener('mouseenter', () => {
        const panel = dropdown.querySelector('[data-dropdown-panel]');
        if (!panel) return;
        closeAll(panel);
        panel.classList.add('is-open');
        dropdown.classList.add('is-open');
        const trigger = dropdown.querySelector('[data-dropdown-trigger]');
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
      });

      dropdown.addEventListener('mouseleave', () => {
        const panel = dropdown.querySelector('[data-dropdown-panel]');
        if (!panel) return;
        panel.classList.remove('is-open');
        dropdown.classList.remove('is-open');
        const trigger = dropdown.querySelector('[data-dropdown-trigger]');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      });
    });

    document.querySelectorAll('[data-dropdown-trigger]').forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = trigger.getAttribute('aria-controls');
        const panel = document.getElementById(id);
        if (!panel) return;
        const willOpen = !panel.classList.contains('is-open');
        closeAll(willOpen ? panel : null);
        panel.classList.toggle('is-open', willOpen);
        panel.closest('[data-dropdown]')?.classList.toggle('is-open', willOpen);
        document.querySelectorAll(`[aria-controls="${id}"]`).forEach((t) => t.setAttribute('aria-expanded', String(willOpen)));
      });
    });

    document.addEventListener('click', () => closeAll());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initPreloader();
    window.__lenis = initSmoothScroll();
    initNavbar();
    initThemeToggle();
    initDropdowns();
    initAOS();
    initCarousels();
    initServiceFilters();
    initAccordion();
    initLeadForms();
    initMarketingBookButtons();
    initCursorGlow();
  });
})();
