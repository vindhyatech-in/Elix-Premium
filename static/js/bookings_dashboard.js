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
   * Status tabs (All/Upcoming/Completed/Cancelled) + search + date —
   * plain class toggling over the server-rendered cards, same
   * "is-hidden" pattern the catalog's own filters use, just without the
   * localStorage/URL state catalog filtering needs (there's nothing to
   * persist here). All three filters combine (AND), not just the tab.
   * ------------------------------------------------------- */
  function initBookingFilters() {
    const tabs = document.querySelectorAll('[data-booking-tab]');
    const cards = document.querySelectorAll('.booking-card');
    const emptyEl = document.querySelector('[data-bookings-tab-empty]');
    const searchInput = document.querySelector('[data-bookings-search]');
    const dateInput = document.querySelector('[data-bookings-date]');
    const clearBtn = document.querySelector('[data-bookings-filter-clear]');
    if (!tabs.length && !searchInput && !dateInput) return;

    let activeStatus = 'all';

    function applyFilters() {
      const query = (searchInput?.value || '').trim().toLowerCase();
      const dateValue = dateInput?.value || '';
      let visibleCount = 0;
      cards.forEach((card) => {
        const statusMatches = activeStatus === 'all' || card.dataset.bookingStatus === activeStatus;
        const searchMatches = !query || (card.dataset.bookingSearch || '').includes(query);
        const dateMatches = !dateValue || card.dataset.bookingDate === dateValue;
        const matches = statusMatches && searchMatches && dateMatches;
        card.classList.toggle('is-hidden', !matches);
        if (matches) visibleCount += 1;
      });
      if (emptyEl) emptyEl.hidden = visibleCount !== 0;
    }

    tabs.forEach((tab) => tab.addEventListener('click', () => {
      tabs.forEach((t) => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      activeStatus = tab.dataset.bookingTab;
      applyFilters();
    }));

    searchInput?.addEventListener('input', applyFilters);
    dateInput?.addEventListener('input', applyFilters);
    clearBtn?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (dateInput) dateInput.value = '';
      applyFilters();
    });
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
        e.preventDefault();
        const GB = window.GlamourBooking;
        const confirmed = GB ? GB.confirmModal('Cancel this booking? This can\'t be undone.') : Promise.resolve(window.confirm('Cancel this booking? This can\'t be undone.'));
        confirmed.then((ok) => { if (ok) form.submit(); });
      });
    });
  }

  function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? match[1] : '';
  }

  /* ---------------------------------------------------------
   * "Call Beautician" / "Help" — deliberately dummy for now (see
   * bookings_dashboard.html): calling will eventually go through a
   * secure/private relay (masked numbers, not the beautician's or
   * customer's real number) rather than a plain tel: link, and that
   * isn't built yet. Just a placeholder toast until it exists.
   * ------------------------------------------------------- */
  function initDummyActions() {
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-dummy-action]');
      if (!btn) return;
      const message = btn.dataset.dummyAction === 'call'
        ? 'Calling is coming soon — this will use secure, private calling.'
        : 'Help is coming soon — reach out to support for now.';
      window.GlamourBooking?.showToast?.(message);
    });
  }

  /* ---------------------------------------------------------
   * Star ratings — one inline picker per completed item, submitted via
   * fetch the instant a star is clicked (see submit_review in
   * bookings/views.py — it's an update_or_create, so clicking a
   * different star later just re-rates rather than erroring). Fills
   * optimistically on click and rolls back only if the request actually
   * fails — there's no separate "Submit" step to wait for.
   * ------------------------------------------------------- */
  function paintStars(picker, rating) {
    picker.querySelectorAll('[data-star-value]').forEach((star) => {
      star.classList.toggle('is-filled', Number(star.dataset.starValue) <= rating);
    });
  }

  function initStarRatings() {
    document.querySelectorAll('[data-star-picker]').forEach((picker) => {
      paintStars(picker, Number(picker.dataset.rating || 0));
    });

    document.body.addEventListener('click', (e) => {
      const star = e.target.closest('[data-star-value]');
      if (!star) return;
      const picker = star.closest('[data-star-picker]');
      if (!picker) return;

      const rating = Number(star.dataset.starValue);
      const previousRating = Number(picker.dataset.rating || 0);
      paintStars(picker, rating);

      fetch(picker.dataset.reviewUrl, {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfToken(), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `rating=${rating}`,
      })
        .then((resp) => resp.json())
        .then((data) => {
          if (!data.ok) throw new Error(data.error || 'Failed to save rating.');
          picker.dataset.rating = String(rating);
        })
        .catch((err) => {
          paintStars(picker, previousRating);
          window.GlamourBooking?.showToast?.(err.message || 'Something went wrong — please try again.');
        });
    });
  }

  /* ---------------------------------------------------------
   * One shared free-text feedback box per completed order (see
   * Booking.feedback_comment) — a single Submit/Update button, not
   * one per item.
   * ------------------------------------------------------- */
  function initBookingFeedback() {
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-feedback-submit]');
      if (!btn) return;
      const block = btn.closest('[data-feedback-block]');
      const textarea = block?.querySelector('[data-feedback-input]');
      const statusEl = block?.querySelector('[data-feedback-status]');
      if (!block || !textarea) return;

      btn.disabled = true;
      const GF = window.GlamourFeedback;
      if (GF) GF.showLoading('Submitting feedback…');
      fetch(block.dataset.feedbackUrl, {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfToken(), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `comment=${encodeURIComponent(textarea.value)}`,
      })
        .then((resp) => resp.json())
        .then((data) => {
          if (!data.ok) throw new Error('Failed to save feedback.');
          btn.textContent = 'Update Feedback';
          if (statusEl) statusEl.hidden = false;
          if (GF) GF.showSuccess('Thank you!', 'Your feedback has been saved.', 3000);
        })
        .catch(() => {
          if (GF) GF.showError('Error', 'Something went wrong — please try again.');
          else window.GlamourBooking?.showToast?.('Something went wrong — please try again.');
        })
        .finally(() => { btn.disabled = false; });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initBookingFilters();
    initRebook();
    initCancelConfirm();
    initStarRatings();
    initBookingFeedback();
    initDummyActions();
  });
})();
