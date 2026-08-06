/**
 * bookings_dashboard.js — /booking/my-bookings/. Depends on
 * window.GlamourBooking (set by booking.js's DOMContentLoaded handler,
 * which always runs first — both scripts are `defer`, executed in source
 * order, so listener registration order guarantees this; same assumption
 * booking_drawer.js already makes).
 */
(function () {
  'use strict';

  /* ---------------------------------------------------------
   * Status tabs (All/Upcoming/Completed/Cancelled) — plain class
   * toggling over the server-rendered cards, same "is-hidden" pattern
   * the catalog's own filters use, just without the localStorage/URL
   * state catalog filtering needs (there's nothing to persist here).
   * ------------------------------------------------------- */
  function initBookingTabs() {
    const tabs = document.querySelectorAll('[data-booking-tab]');
    const cards = document.querySelectorAll('.booking-card');
    const emptyEl = document.querySelector('[data-bookings-tab-empty]');
    if (!tabs.length) return;

    tabs.forEach((tab) => tab.addEventListener('click', () => {
      tabs.forEach((t) => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      const status = tab.dataset.bookingTab;
      let visibleCount = 0;
      cards.forEach((card) => {
        const matches = status === 'all' || card.dataset.bookingStatus === status;
        card.classList.toggle('is-hidden', !matches);
        if (matches) visibleCount += 1;
      });
      if (emptyEl) emptyEl.hidden = visibleCount !== 0;
    }));
  }

  /* ---------------------------------------------------------
   * Rebook — re-adds a past booking's items to the cart. Each booking's
   * rebookable items are embedded server-side (bookings_dashboard view)
   * as a json_script keyed by booking_number — only items whose
   * ServiceVariant/Service are still active are included, so an empty
   * list here means nothing on that booking can be rebooked anymore.
   * ------------------------------------------------------- */
  function initRebook() {
    const GB = window.GlamourBooking;
    if (!GB) return;

    function normalizedVariantId(v) { return v === undefined || v === null || v === '' ? null : Number(v); }

    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-rebook]');
      if (!btn) return;

      const dataEl = document.getElementById(btn.dataset.bookingNumber);
      let items = [];
      try {
        items = dataEl ? JSON.parse(dataEl.textContent) : [];
      } catch (err) {
        items = [];
      }
      if (!items.length) {
        GB.showToast('Sorry, these items are no longer available.');
        return;
      }

      const cart = GB.getCart();
      items.forEach((entry) => {
        const variantId = normalizedVariantId(entry.variantId);
        const line = cart.find((l) => l.id === entry.id && normalizedVariantId(l.variantId) === variantId);
        if (line) line.qty += entry.qty; else cart.push({ id: entry.id, variantId, qty: entry.qty });
      });
      GB.saveCart(cart);
      GB.showToast('Added to cart');
    });
  }

  /* ---------------------------------------------------------
   * Cancel booking — a plain server-rendered <form method="post"> (see
   * bookings_dashboard.html) does the actual work; this only guards
   * against an accidental tap/click before the request goes out. No
   * fetch/AJAX here on purpose — the resulting page reload is what shows
   * the booking's new "Cancelled" status and moves it between tabs, same
   * as any other Django form.
   * ------------------------------------------------------- */
  function initCancelConfirm() {
    document.querySelectorAll('[data-cancel-booking-form]').forEach((form) => {
      form.addEventListener('submit', (e) => {
        if (!window.confirm('Cancel this booking? This can\'t be undone.')) e.preventDefault();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initBookingTabs();
    initRebook();
    initCancelConfirm();
  });
})();
