/**
 * booking_drawer.js — Phase 2: the actual 5-step booking flow (address →
 * date → booking type/time → payment → summary), opened as a drawer from
 * the cart's "Proceed to Booking" button. Never lets the customer pick a
 * beautician, by design.
 *
 * Depends on window.GlamourBooking (set by booking.js's DOMContentLoaded
 * handler, which always runs first — both scripts are `defer`, executed in
 * source order, so listener registration order guarantees this). No Google
 * Maps / Razorpay keys exist yet, so:
 *  - the address step uses Leaflet + OpenStreetMap tiles (free, keyless,
 *    genuinely interactive) instead of a static placeholder image.
 *  - the payment step's "Pay Now" simulates a checkout (processing →
 *    success), same pattern as main.js's contact/newsletter form handlers.
 *
 * "Proceed to Booking" is gated on window.body.dataset.authenticated (set
 * by booking_base.html from request.user) — signed-out users get redirected
 * to login instead of the drawer opening. confirmBooking() (added
 * 2026-07-31) does a real POST to /services-booking/book/ and creates
 * actual Booking/BookingItem rows — no more a client-generated mock id.
 * See developed.md "Catalog & Bookings models" for the full rationale.
 */
(function () {
  'use strict';

  const ADDRESS_KEY = 'glamour_addresses';

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // Django's standard AJAX CSRF pattern — reads the csrftoken cookie the
  // CSRF middleware already sets, sent back as the X-CSRFToken header.
  // Nothing needed this until confirmBooking() started making a real POST.
  function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function initBookingDrawer() {
    const GB = window.GlamourBooking;
    const drawer = document.getElementById('booking-drawer');
    const backdrop = document.querySelector('[data-booking-backdrop]');
    if (!GB || !drawer || !backdrop) return;

    let state = {
      step: 1, addressId: null, date: null, type: 'regular',
      slot: null, urgentTime: null, payment: null, paymentConfirmed: false,
    };
    let calendarMonth, calendarYear;
    let map, marker;
    let pendingPin = null;
    let justConfirmed = false; // true from confirmBooking() until resetState() — see the cart-changed listener below

    const addressListEl = drawer.querySelector('[data-address-list]');
    const addressForm = drawer.querySelector('[data-address-form]');
    const calendarGrid = drawer.querySelector('[data-calendar-grid]');
    const calendarLabel = drawer.querySelector('[data-calendar-label]');
    const typeButtons = drawer.querySelectorAll('[data-booking-type-value]');
    const regularSlots = drawer.querySelector('[data-regular-slots]');
    const urgentTimeWrap = drawer.querySelector('[data-urgent-time]');
    const urgentTimeInput = drawer.querySelector('[data-urgent-time-input]');
    const paymentButtons = drawer.querySelectorAll('[data-payment-value]');
    const paymentMock = drawer.querySelector('[data-payment-mock]');
    const payAmountEl = drawer.querySelector('[data-pay-amount]');
    const paymentStatusEl = drawer.querySelector('[data-payment-status]');
    const nextBtn = drawer.querySelector('[data-booking-next]');
    const backBtn = drawer.querySelector('[data-booking-back]');
    const footer = drawer.querySelector('[data-booking-footer]');
    const stepper = drawer.querySelector('[data-booking-stepper]');
    const confirmationEl = drawer.querySelector('[data-booking-confirmation]');

    /* --- Addresses (localStorage) --- */
    function getAddresses() {
      try { return JSON.parse(localStorage.getItem(ADDRESS_KEY)) || []; } catch (e) { return []; }
    }
    function saveAddresses(list) { localStorage.setItem(ADDRESS_KEY, JSON.stringify(list)); }

    function renderAddressList() {
      const addresses = getAddresses();
      addressListEl.innerHTML = '';
      if (!addresses.length) {
        addressListEl.innerHTML = '<p class="address-list__empty">No saved addresses yet — add one below.</p>';
        return;
      }
      addresses.forEach((addr) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `address-card${state.addressId === addr.id ? ' is-selected' : ''}`;
        card.dataset.addressId = addr.id;
        card.innerHTML = `<strong>${escapeHtml(addr.label)}</strong>
          <p>${escapeHtml(addr.text)}${addr.pincode ? ' — ' + escapeHtml(addr.pincode) : ''}</p>`;
        addressListEl.appendChild(card);
      });
    }

    addressListEl.addEventListener('click', (e) => {
      const card = e.target.closest('[data-address-id]');
      if (!card) return;
      state.addressId = card.dataset.addressId;
      renderAddressList();
      updateNextButtonState();
    });

    drawer.querySelector('[data-add-address-toggle]').addEventListener('click', () => {
      addressForm.hidden = !addressForm.hidden;
      if (!addressForm.hidden) initMap();
    });
    drawer.querySelector('[data-address-cancel]').addEventListener('click', () => { addressForm.hidden = true; });

    function initMap() {
      if (map) { setTimeout(() => map.invalidateSize(), 50); return; }
      if (typeof L === 'undefined') return; // CDN unavailable — form still works without a map

      // Leaflet's default marker icon uses relative image paths resolved
      // against the CSS file's own location — broken when leaflet.css is
      // loaded from a CDN link tag, a well-known Leaflet+CDN gotcha. Point
      // it at the same CDN's image assets explicitly.
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      map = L.map('booking-map', { attributionControl: false }).setView([12.9716, 77.5946], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
      map.on('click', (e) => {
        pendingPin = { lat: e.latlng.lat, lng: e.latlng.lng };
        if (marker) marker.setLatLng(e.latlng); else marker = L.marker(e.latlng).addTo(map);
      });
      setTimeout(() => map.invalidateSize(), 50);
    }

    drawer.querySelector('[data-address-save]').addEventListener('click', () => {
      const labelInput = drawer.querySelector('[data-address-label]');
      const textInput = drawer.querySelector('[data-address-text]');
      const pincodeInput = drawer.querySelector('[data-address-pincode]');
      const text = textInput.value.trim();
      if (!text) { GB.showToast('Enter your full address'); return; }

      const addresses = getAddresses();
      const id = `addr-${Date.now()}`;
      addresses.push({
        id,
        label: labelInput.value.trim() || 'Address',
        text,
        pincode: pincodeInput.value.trim(),
        lat: pendingPin ? pendingPin.lat : null,
        lng: pendingPin ? pendingPin.lng : null,
      });
      saveAddresses(addresses);

      state.addressId = id;
      addressForm.hidden = true;
      labelInput.value = ''; textInput.value = ''; pincodeInput.value = '';
      pendingPin = null;
      if (marker) { marker.remove(); marker = null; }
      renderAddressList();
      updateNextButtonState();
      GB.showToast('Address saved');
    });

    /* --- Calendar (hand-rolled month grid) --- */
    function toISODate(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function renderCalendar() {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      calendarLabel.textContent = `${monthNames[calendarMonth]} ${calendarYear}`;
      calendarGrid.innerHTML = '';

      const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
      const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < firstDay; i++) {
        const blank = document.createElement('span');
        blank.className = 'booking-calendar__day booking-calendar__day--blank';
        calendarGrid.appendChild(blank);
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(calendarYear, calendarMonth, d);
        const iso = toISODate(dateObj);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'booking-calendar__day';
        btn.textContent = String(d);
        btn.dataset.date = iso;
        if (dateObj < today) { btn.disabled = true; btn.classList.add('is-past'); }
        if (state.date === iso) btn.classList.add('is-selected');
        calendarGrid.appendChild(btn);
      }
    }

    drawer.querySelector('[data-calendar-prev]').addEventListener('click', () => {
      calendarMonth -= 1;
      if (calendarMonth < 0) { calendarMonth = 11; calendarYear -= 1; }
      renderCalendar();
    });
    drawer.querySelector('[data-calendar-next]').addEventListener('click', () => {
      calendarMonth += 1;
      if (calendarMonth > 11) { calendarMonth = 0; calendarYear += 1; }
      renderCalendar();
    });
    calendarGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-date]');
      if (!btn || btn.disabled) return;
      state.date = btn.dataset.date;
      renderCalendar();
      updateNextButtonState();
    });

    /* --- Booking type / slots --- */
    typeButtons.forEach((btn) => btn.addEventListener('click', () => {
      typeButtons.forEach((b) => { b.classList.remove('is-active'); b.setAttribute('aria-checked', 'false'); });
      btn.classList.add('is-active');
      btn.setAttribute('aria-checked', 'true');
      state.type = btn.dataset.bookingTypeValue;
      state.slot = null;
      state.urgentTime = null;
      regularSlots.querySelectorAll('.slot-card').forEach((c) => c.classList.remove('is-selected'));
      urgentTimeInput.value = '';
      regularSlots.hidden = state.type !== 'regular';
      urgentTimeWrap.hidden = state.type !== 'urgent';
      updateNextButtonState();
    }));

    regularSlots.addEventListener('click', (e) => {
      const card = e.target.closest('.slot-card');
      if (!card) return;
      regularSlots.querySelectorAll('.slot-card').forEach((c) => c.classList.remove('is-selected'));
      card.classList.add('is-selected');
      state.slot = card.dataset.slotValue;
      updateNextButtonState();
    });

    urgentTimeInput.addEventListener('input', (e) => {
      state.urgentTime = e.target.value;
      updateNextButtonState();
    });

    /* --- Payment --- */
    function cartTotal() {
      const cart = GB.getCart();
      const catalog = GB.getCatalog();
      let subtotal = 0;
      cart.forEach((line) => {
        const item = catalog.find((i) => i.id === line.id);
        if (item) subtotal += item.price * line.qty;
      });
      const rate = GB.getAppliedDiscountRate();
      const discount = Math.round(subtotal * rate);
      return { subtotal, discount, total: subtotal - discount };
    }

    paymentButtons.forEach((btn) => btn.addEventListener('click', () => {
      paymentButtons.forEach((b) => { b.classList.remove('is-selected'); b.setAttribute('aria-checked', 'false'); });
      btn.classList.add('is-selected');
      btn.setAttribute('aria-checked', 'true');
      state.payment = btn.dataset.paymentValue;
      state.paymentConfirmed = state.payment === 'pay-at-home';
      paymentStatusEl.textContent = '';
      if (state.payment === 'pay-now') {
        paymentMock.hidden = false;
        payAmountEl.textContent = GB.formatCurrency(cartTotal().total);
      } else {
        paymentMock.hidden = true;
      }
      updateNextButtonState();
    }));

    drawer.querySelector('[data-pay-now-simulate]').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      paymentStatusEl.textContent = 'Processing payment…';
      setTimeout(() => {
        state.paymentConfirmed = true;
        paymentStatusEl.textContent = '✓ Payment successful';
        btn.disabled = false;
        updateNextButtonState();
      }, 1200);
    });

    /* --- Summary (step 5) --- */
    function slotLabel(slot) {
      return {
        morning: 'Morning (8 AM – 12 PM)',
        afternoon: 'Afternoon (12 PM – 4 PM)',
        evening: 'Evening (4 PM – 8 PM)',
      }[slot] || '—';
    }

    function formatDateLabel(iso) {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }

    function renderSummary() {
      const el = drawer.querySelector('[data-booking-summary]');
      const address = getAddresses().find((a) => a.id === state.addressId);
      const cart = GB.getCart();
      const catalog = GB.getCatalog();
      const { subtotal, discount, total } = cartTotal();

      const dateLabel = state.date ? formatDateLabel(state.date) : '—';
      const timeLabel = state.type === 'urgent' ? `${state.urgentTime || '—'} today (Urgent)` : slotLabel(state.slot);
      const paymentLabel = state.payment === 'pay-now' ? 'Paid online' : 'Pay at home';

      const itemsHtml = cart.map((line) => {
        const item = catalog.find((i) => i.id === line.id);
        if (!item) return '';
        return `<div class="booking-summary__item"><span>${escapeHtml(item.name)} × ${line.qty}</span><span>${GB.formatCurrency(item.price * line.qty)}</span></div>`;
      }).join('');

      el.innerHTML = `
        <div class="booking-summary__row"><strong>Address</strong><p>${address ? `${escapeHtml(address.label)} — ${escapeHtml(address.text)}` : '—'}</p></div>
        <div class="booking-summary__row"><strong>Date &amp; Time</strong><p>${escapeHtml(dateLabel)} · ${escapeHtml(timeLabel)}</p></div>
        <div class="booking-summary__row"><strong>Payment</strong><p>${escapeHtml(paymentLabel)}</p></div>
        <div class="booking-summary__items">${itemsHtml}</div>
        <div class="booking-summary__totals">
          <div class="floating-cart__row"><span>Subtotal</span><span>${GB.formatCurrency(subtotal)}</span></div>
          ${discount > 0 ? `<div class="floating-cart__row floating-cart__row--discount"><span>Discount</span><span>-${GB.formatCurrency(discount)}</span></div>` : ''}
          <div class="floating-cart__row floating-cart__row--total"><span>Total</span><span>${GB.formatCurrency(total)}</span></div>
        </div>`;
    }

    /* --- Step navigation --- */
    function validateStep(step) {
      if (step === 1) return !!state.addressId;
      if (step === 2) return !!state.date;
      if (step === 3) return state.type === 'regular' ? !!state.slot : !!state.urgentTime;
      if (step === 4) return !!state.payment && state.paymentConfirmed;
      return true;
    }

    function updateNextButtonState() {
      nextBtn.disabled = !validateStep(state.step);
    }

    function goToStep(step) {
      state.step = step;
      drawer.querySelectorAll('.booking-step').forEach((sec) => {
        sec.classList.toggle('is-active', Number(sec.dataset.bookingStep) === step);
      });
      drawer.querySelectorAll('[data-step-indicator]').forEach((dot) => {
        const n = Number(dot.dataset.stepIndicator);
        dot.classList.toggle('is-active', n === step);
        dot.classList.toggle('is-complete', n < step);
      });
      backBtn.disabled = step === 1;
      nextBtn.textContent = step === 5 ? 'Confirm Booking' : 'Next';
      if (step === 5) renderSummary();
      updateNextButtonState();
      drawer.querySelector('.booking-drawer__body').scrollTop = 0;
    }

    backBtn.addEventListener('click', () => { if (state.step > 1) goToStep(state.step - 1); });

    nextBtn.addEventListener('click', () => {
      if (!validateStep(state.step)) return;
      if (state.step < 5) { goToStep(state.step + 1); return; }
      confirmBooking();
    });

    async function confirmBooking() {
      const address = getAddresses().find((a) => a.id === state.addressId);
      const payload = {
        address: address ? {
          label: address.label, text: address.text, pincode: address.pincode,
          lat: address.lat, lng: address.lng,
        } : null,
        date: state.date,
        booking_type: state.type,
        time_slot: state.type === 'regular' ? state.slot : '',
        exact_time: state.type === 'urgent' ? state.urgentTime : '',
        payment_method: state.payment,
        coupon_code: GB.getAppliedCouponCode() || '',
        cart: GB.getCart(),
      };

      nextBtn.disabled = true;
      nextBtn.textContent = 'Confirming…';

      let data;
      try {
        const response = await fetch('/services-booking/book/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
          body: JSON.stringify(payload),
        });
        data = await response.json();
        if (!response.ok || !data.ok) {
          nextBtn.disabled = false;
          nextBtn.textContent = 'Confirm Booking';
          GB.showToast(data.error || 'Something went wrong — please try again.');
          if (data.login_required) {
            const loginUrl = document.body.dataset.loginUrl || '/accounts/login/';
            window.location.href = `${loginUrl}?next=${encodeURIComponent(window.location.pathname)}`;
          }
          return;
        }
      } catch (err) {
        nextBtn.disabled = false;
        nextBtn.textContent = 'Confirm Booking';
        GB.showToast('Network error — please try again.');
        return;
      }

      drawer.querySelector('[data-confirmation-id]').textContent = data.booking_number;
      drawer.querySelectorAll('.booking-step').forEach((s) => s.classList.remove('is-active'));
      confirmationEl.hidden = false;
      footer.hidden = true;
      stepper.hidden = true;
      // Set before saveCart(): saveCart() dispatches glamour:cart-changed
      // synchronously, which the "emptied from outside" listener below would
      // otherwise treat as an external clear and immediately resetState(),
      // undoing the confirmation screen just shown above.
      justConfirmed = true;
      GB.saveCart([]);
      GB.showToast('Booking confirmed!');
    }

    drawer.querySelector('[data-booking-done]').addEventListener('click', () => {
      closeDrawer();
      // Delay past closeDrawer's own 350ms transition — resetting immediately
      // would flash step 1's content behind the confirmation screen while
      // the drawer is still visibly sliding shut.
      setTimeout(resetState, 380);
    });

    function resetState() {
      state = { step: 1, addressId: null, date: null, type: 'regular', slot: null, urgentTime: null, payment: null, paymentConfirmed: false };
      justConfirmed = false;
      confirmationEl.hidden = true;
      footer.hidden = false;
      stepper.hidden = false;
      addressForm.hidden = true;
      typeButtons.forEach((b, i) => { b.classList.toggle('is-active', i === 0); b.setAttribute('aria-checked', String(i === 0)); });
      regularSlots.hidden = false;
      urgentTimeWrap.hidden = true;
      regularSlots.querySelectorAll('.slot-card').forEach((c) => c.classList.remove('is-selected'));
      urgentTimeInput.value = '';
      paymentButtons.forEach((b) => { b.classList.remove('is-selected'); b.setAttribute('aria-checked', 'false'); });
      paymentMock.hidden = true;
      paymentStatusEl.textContent = '';
      const today = new Date();
      calendarMonth = today.getMonth();
      calendarYear = today.getFullYear();
      renderCalendar();
      renderAddressList();
      goToStep(1);
    }

    /* --- Open / close --- */
    function openDrawer() {
      drawer.hidden = false;
      backdrop.hidden = false;
      requestAnimationFrame(() => { drawer.classList.add('is-open'); backdrop.classList.add('is-open'); });
      document.body.style.overflow = 'hidden';
      if (map) setTimeout(() => map.invalidateSize(), 300);
    }
    function closeDrawer() {
      drawer.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(() => { drawer.hidden = true; backdrop.hidden = true; }, 350);
    }

    document.querySelector('[data-proceed-to-booking]')?.addEventListener('click', () => {
      if (GB.getCart().length === 0) return;
      // Gated here (before the drawer even opens) rather than at the final
      // Confirm step — filling all 5 steps only to be told "please sign in"
      // would be a worse experience. The cart (localStorage) survives the
      // login redirect untouched since it isn't tied to the session.
      if (document.body.dataset.authenticated !== 'true') {
        const loginUrl = document.body.dataset.loginUrl || '/accounts/login/';
        window.location.href = `${loginUrl}?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      openDrawer();
    });
    drawer.querySelector('[data-booking-close]').addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer(); });

    // Cart emptied from outside the drawer (e.g. mini-cart cleared while the
    // drawer is closed) — stale in-progress state would reference items
    // that no longer exist, so reset it. Skipped when the emptying was
    // confirmBooking()'s own doing — that already shows its own
    // confirmation screen and resets on "Done", not immediately.
    window.addEventListener('glamour:cart-changed', () => {
      if (justConfirmed) return;
      if (GB.getCart().length === 0 && state.step !== 1) resetState();
    });

    resetState();
  }

  document.addEventListener('DOMContentLoaded', initBookingDrawer);
})();
