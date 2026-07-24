/**
 * animations.js — bespoke motion: hero canvas, text reveal, scroll-scrubbed
 * line draw, sticky story frames, before/after drag, counters, card tilt.
 * Kept separate from main.js so library bootstrapping stays easy to scan.
 */
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined';

  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------------------------------------------------------
   * Hero background — soft floating gradient orbs (canvas 2D)
   * ------------------------------------------------------- */
  function initHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height, orbs, rafId;

    const palette = ['rgba(201,161,90,0.22)', 'rgba(233,200,194,0.28)', 'rgba(22,18,15,0.06)'];

    function resize() {
      width = canvas.width = canvas.offsetWidth * devicePixelRatio;
      height = canvas.height = canvas.offsetHeight * devicePixelRatio;
    }

    function makeOrbs() {
      const count = window.innerWidth < 768 ? 3 : 5;
      orbs = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: (Math.random() * 0.18 + 0.12) * Math.min(width, height),
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        color: palette[i % palette.length],
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      orbs.forEach((orb) => {
        orb.x += orb.vx; orb.y += orb.vy;
        if (orb.x < -orb.r) orb.x = width + orb.r;
        if (orb.x > width + orb.r) orb.x = -orb.r;
        if (orb.y < -orb.r) orb.y = height + orb.r;
        if (orb.y > height + orb.r) orb.y = -orb.r;

        const gradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fill();
      });
      rafId = requestAnimationFrame(draw);
    }

    resize();
    makeOrbs();

    if (prefersReducedMotion) {
      draw(); cancelAnimationFrame(rafId); // one static frame, no loop
    } else {
      draw();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) cancelAnimationFrame(rafId);
        else draw();
      });
    }

    window.addEventListener('resize', () => { resize(); makeOrbs(); }, { passive: true });
  }

  /* ---------------------------------------------------------
   * Hero headline reveal — runs once the preloader clears
   * ------------------------------------------------------- */
  function initHeroReveal() {
    const lines = document.querySelectorAll('.hero__line-inner');
    if (!lines.length) return;

    if (!hasGSAP || prefersReducedMotion) {
      lines.forEach((line) => { line.style.transform = 'translateY(0)'; });
      return;
    }

    const play = () => {
      gsap.to(lines, {
        y: '0%',
        duration: 1,
        ease: 'power4.out',
        stagger: 0.12,
        delay: 0.2,
      });
    };

    window.addEventListener('glamour:loaded', play, { once: true });
    setTimeout(play, 1200); // fallback if preloader event is delayed/skipped
  }

  /* ---------------------------------------------------------
   * Count-up stats (hero + trust)
   * ------------------------------------------------------- */
  function initCounters() {
    const counters = document.querySelectorAll('[data-counter]');
    if (!counters.length) return;

    const format = (value, target) => {
      const isDecimal = target % 1 !== 0;
      return isDecimal ? value.toFixed(1) : Math.round(value).toLocaleString('en-IN');
    };

    const animateCounter = (el) => {
      const target = parseFloat(el.dataset.target);
      const suffix = el.dataset.suffix || '';
      if (prefersReducedMotion || !hasGSAP) {
        el.textContent = format(target, target) + suffix;
        return;
      }
      const state = { value: 0 };
      gsap.to(state, {
        value: target,
        duration: 1.8,
        ease: 'power2.out',
        onUpdate: () => { el.textContent = format(state.value, target) + suffix; },
      });
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });

    counters.forEach((el) => observer.observe(el));
  }

  /* ---------------------------------------------------------
   * "Why Us" — sticky visual swaps as pillars scroll past
   * ------------------------------------------------------- */
  function initWhyUsSticky() {
    const pillars = document.querySelectorAll('.pillar');
    const frames = document.querySelectorAll('.why-us__frame');
    const sticky = document.querySelector('.why-us__sticky');
    if (!pillars.length || !frames.length) return;

    // Keeps the sticky image roughly level with whichever pillar text is
    // currently focused, instead of sitting frozen at one fixed height.
    //
    // Two earlier approaches both under-shot this:
    //  1. A fixed index-based step (equal % of a hardcoded constant) needed
    //     a magic-number travel distance that never quite matched reality.
    //  2. Estimating travel from (list height - sticky height) was closer
    //     but still an approximation, and visibly fell short of the real
    //     gap by the last pillar.
    // This version measures the ACTUAL live pixel distance between the
    // active pillar's center and the first pillar's center via
    // getBoundingClientRect() every time — a direct 1:1 correspondence with
    // how far the text has really scrolled, not an estimate of it. No
    // hardcoded constant, no clamp — the image moves exactly as far as the
    // text did.
    function focusImageOn(pillar) {
      if (!sticky || !hasGSAP || prefersReducedMotion) return;
      const firstRect = pillars[0].getBoundingClientRect();
      const activeRect = pillar.getBoundingClientRect();
      const firstCenter = firstRect.top + firstRect.height / 2;
      const activeCenter = activeRect.top + activeRect.height / 2;
      const targetY = activeCenter - firstCenter;
      gsap.to(sticky, { y: targetY, duration: 0.7, ease: 'power3.out', overwrite: 'auto' });
    }

    // A thin trigger band at the vertical center of the viewport (rather than
    // a wide ±15% band) means only one pillar crosses it at a time during a
    // normal scroll — a wide band let several pillars register "intersecting"
    // within the same scroll tick, flipping the active frame rapidly. This is
    // the standard single-trigger-line scrollytelling pattern.
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const index = entry.target.dataset.pillar;
        pillars.forEach((p) => p.classList.toggle('is-active', p.dataset.pillar === index));
        frames.forEach((f) => f.classList.toggle('is-active', f.dataset.frame === index));
        focusImageOn(entry.target);
      });
    }, { threshold: 0, rootMargin: '-48% 0px -48% 0px' });

    pillars.forEach((p) => observer.observe(p));
  }

  /* ---------------------------------------------------------
   * "How It Works" — scroll-scrubbed connecting line
   * ------------------------------------------------------- */
  function initTimelineLine() {
    const track = document.querySelector('[data-hiw-track]');
    const fill = document.querySelector('[data-line-fill]');
    if (!track || !fill || !hasGSAP || !window.ScrollTrigger) return;

    gsap.to(fill, {
      width: '100%',
      ease: 'none',
      scrollTrigger: {
        trigger: track,
        start: 'top 75%',
        end: 'bottom 60%',
        scrub: 0.6,
      },
    });
  }

  /* ---------------------------------------------------------
   * Before / after comparison sliders (gallery)
   * ------------------------------------------------------- */
  function initCompareSliders() {
    document.querySelectorAll('[data-compare]').forEach((box) => {
      const range = box.querySelector('[data-compare-range]');
      const after = box.querySelector('[data-compare-after]');
      const handle = box.querySelector('[data-compare-handle]');
      if (!range) return;

      const update = () => {
        const value = range.value + '%';
        after.style.setProperty('--pos', value);
        handle.style.left = value;
      };
      range.addEventListener('input', update);
      update();
    });
  }

  /* ---------------------------------------------------------
   * Subtle magnetic tilt on service cards (pointer:fine only)
   * ------------------------------------------------------- */
  function initCardTilt() {
    if (!isFinePointer || prefersReducedMotion) return;
    document.querySelectorAll('.service-card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(800px) rotateX(${py * -4}deg) rotateY(${px * 4}deg) translateY(-8px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initHeroCanvas();
    initHeroReveal();
    initCounters();
    initWhyUsSticky();
    initTimelineLine();
    initCompareSliders();
    initCardTilt();
  });
})();
