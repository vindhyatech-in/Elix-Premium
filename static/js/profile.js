/**
 * profile.js — /booking/profile/. Add/delete against the same
 * JSON address API (accounts/views.py::addresses_api / address_delete)
 * the booking drawer's address step now reads from too — see
 * developed.md "Profile & saved addresses". Reloads the page on success
 * rather than hand-rendering the new/removed card client-side — this page
 * has no other state worth preserving across that reload, so it's not
 * worth duplicating the server's row markup in JS just to avoid one.
 */
(function () {
  'use strict';

  function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  // window.GlamourBooking is set by booking.js's DOMContentLoaded handler,
  // which always runs first — both scripts are `defer`, executed in
  // source order (same assumption booking_drawer.js/bookings_dashboard.js
  // already make).
  function showToast(message) {
    if (window.GlamourBooking) window.GlamourBooking.showToast(message);
    else window.alert(message);
  }

  function initAddressForm() {
    const form = document.querySelector('[data-address-form]');
    const toggleBtn = document.querySelector('[data-add-address-toggle]');
    if (!form || !toggleBtn) return;

    toggleBtn.addEventListener('click', () => { form.hidden = !form.hidden; });
    document.querySelector('[data-address-cancel]')?.addEventListener('click', () => { form.hidden = true; });

    document.querySelector('[data-address-save]')?.addEventListener('click', async () => {
      const labelInput = document.querySelector('[data-address-label]');
      const textInput = document.querySelector('[data-address-text]');
      const pincodeInput = document.querySelector('[data-address-pincode]');
      const text = textInput.value.trim();
      if (!text) { showToast('Enter your full address'); return; }

      const GF = window.GlamourFeedback;
      if (GF) GF.showLoading('Saving address…');
      try {
        const response = await fetch('/booking/addresses/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
          body: JSON.stringify({
            label: labelInput.value.trim(),
            text,
            pincode: pincodeInput.value.trim(),
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          if (GF) GF.showError('Error', data.error || 'Something went wrong — please try again.');
          else showToast(data.error || 'Something went wrong — please try again.');
          return;
        }
      } catch (err) {
        if (GF) GF.showError('Network Error', 'Please try again.');
        else showToast('Network error — please try again.');
        return;
      } finally {
        if (GF) GF.hideLoading();
      }
      window.location.reload();
    });
  }

  function initAddressDelete() {
    document.body.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-delete-address]');
      if (!btn) return;
      const confirmed = window.GlamourBooking
        ? await window.GlamourBooking.confirmModal('Delete this address?')
        : window.confirm('Delete this address?');
      if (!confirmed) return;

      const GF = window.GlamourFeedback;
      if (GF) GF.showLoading('Deleting…');
      try {
        const response = await fetch(`/booking/addresses/${btn.dataset.addressId}/`, {
          method: 'DELETE',
          headers: { 'X-CSRFToken': getCsrfToken() },
        });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          if (GF) GF.showError('Error', 'Something went wrong — please try again.');
          else showToast('Something went wrong — please try again.');
          return;
        }
      } catch (err) {
        if (GF) GF.showError('Network Error', 'Please try again.');
        else showToast('Network error — please try again.');
        return;
      } finally {
        if (GF) GF.hideLoading();
      }
      window.location.reload();
    });
  }

  /* ---------------------------------------------------------
   * Delete Account — a plain server-rendered <form method="post"> (see
   * profile.html's "Delete Account" card) does the actual work; this
   * only gates it behind a confirm since it's immediate and permanent
   * (see accounts/views.py::delete_account).
   * ------------------------------------------------------- */
  function initDeleteAccount() {
    const form = document.querySelector('[data-delete-account-form]');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = 'Permanently delete your account? This cannot be undone — your profile, addresses, and reviews will be removed immediately.';
      const confirmed = window.GlamourBooking
        ? await window.GlamourBooking.confirmModal(message)
        : window.confirm(message);
      if (confirmed) form.submit();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initAddressForm();
    initAddressDelete();
    initDeleteAccount();
  });
})();
