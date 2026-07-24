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

  document.addEventListener('DOMContentLoaded', () => {
    initPreloader();
    window.__lenis = initSmoothScroll();
    initNavbar();
    initAOS();
    initCarousels();
    initServiceFilters();
    initAccordion();
    initLeadForms();
    initCursorGlow();
  });
})();
