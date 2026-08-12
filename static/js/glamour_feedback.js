/**
 * glamour_feedback.js — shared AJAX feedback helpers.
 *
 * Exposes window.GlamourFeedback with:
 *   showLoading(title)              blocking spinner overlay
 *   hideLoading()                   dismiss the overlay
 *   showSuccess(title, text, ms)    auto-dismissing success banner
 *   showError(title, text)          persistent error banner (click X to close)
 *
 * Zero external dependencies.  Works in all three zones (public, admin,
 * employee) because it owns its own DOM element and stylesheet injected once
 * on first use.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Styles                                                               */
  /* ------------------------------------------------------------------ */
  var STYLE_ID = 'gf-styles';
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#gf-overlay{',
      '  position:fixed;inset:0;z-index:99999;',
      '  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;',
      '  background:rgba(0,0,0,.55);backdrop-filter:blur(3px);',
      '  transition:opacity .2s;',
      '}',
      '#gf-overlay.gf-hidden{opacity:0;pointer-events:none;}',

      '.gf-spinner{',
      '  width:48px;height:48px;',
      '  border:4px solid rgba(255,255,255,.25);',
      '  border-top-color:#c9a15a;',
      '  border-radius:50%;',
      '  animation:gf-spin .75s linear infinite;',
      '}',
      '@keyframes gf-spin{to{transform:rotate(360deg)}}',

      '.gf-overlay-title{',
      '  color:#fff;font-size:1rem;font-weight:600;',
      '  font-family:Inter,system-ui,sans-serif;letter-spacing:.02em;',
      '}',

      '.gf-toast{',
      '  position:fixed;top:1.25rem;left:50%;transform:translateX(-50%);',
      '  z-index:100000;min-width:280px;max-width:calc(100vw - 2rem);',
      '  border-radius:10px;padding:.9rem 1.2rem;',
      '  display:flex;align-items:flex-start;gap:.75rem;',
      '  box-shadow:0 8px 30px rgba(0,0,0,.3);',
      '  font-family:Inter,system-ui,sans-serif;font-size:.9rem;',
      '  animation:gf-slide-in .25s ease;',
      '}',
      '.gf-toast.gf-dismissing{animation:gf-slide-out .25s ease forwards;}',
      '@keyframes gf-slide-in{from{opacity:0;transform:translateX(-50%) translateY(-12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}',
      '@keyframes gf-slide-out{from{opacity:1;transform:translateX(-50%) translateY(0)}to{opacity:0;transform:translateX(-50%) translateY(-12px)}}',

      '.gf-toast--success{background:#0f6b3c;color:#fff;}',
      '.gf-toast--error  {background:#7f1d1d;color:#fff;}',

      '.gf-toast__icon{font-size:1.2rem;line-height:1;flex-shrink:0;padding-top:.05em;}',
      '.gf-toast__body{flex:1;display:flex;flex-direction:column;gap:.15rem;}',
      '.gf-toast__title{font-weight:700;}',
      '.gf-toast__text {opacity:.85;font-size:.82rem;}',
      '.gf-toast__close{',
      '  background:none;border:none;color:inherit;opacity:.7;cursor:pointer;',
      '  font-size:1.1rem;line-height:1;padding:0;flex-shrink:0;',
      '}',
      '.gf-toast__close:hover{opacity:1;}',

      '.gf-toast__progress{',
      '  position:absolute;bottom:0;left:0;height:3px;',
      '  background:rgba(255,255,255,.4);border-radius:0 0 10px 10px;',
      '  transform-origin:left;',
      '}',
    ].join('');
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ */
  /* Overlay (blocking spinner)                                           */
  /* ------------------------------------------------------------------ */
  var overlayEl = null;

  function getOverlay() {
    if (!overlayEl) {
      ensureStyles();
      overlayEl = document.createElement('div');
      overlayEl.id = 'gf-overlay';
      overlayEl.classList.add('gf-hidden');
      overlayEl.innerHTML = '<div class="gf-spinner"></div><span class="gf-overlay-title" id="gf-overlay-title"></span>';
      document.body.appendChild(overlayEl);
    }
    return overlayEl;
  }

  function showLoading(title) {
    var el = getOverlay();
    document.getElementById('gf-overlay-title').textContent = title || 'Please wait\u2026';
    el.classList.remove('gf-hidden');
  }

  function hideLoading() {
    if (overlayEl) overlayEl.classList.add('gf-hidden');
  }

  /* ------------------------------------------------------------------ */
  /* Toasts                                                               */
  /* ------------------------------------------------------------------ */
  function showToast(opts) {
    ensureStyles();
    var toast = document.createElement('div');
    toast.className = 'gf-toast gf-toast--' + opts.type;

    var textHtml = opts.text ? '<span class="gf-toast__text">' + escHtml(opts.text) + '</span>' : '';
    var progressHtml = opts.timerMs ? '<div class="gf-toast__progress" id="gf-tp-' + Date.now() + '"></div>' : '';
    var progressId = opts.timerMs ? 'gf-tp-' + Date.now() : null;

    toast.innerHTML = [
      '<span class="gf-toast__icon">' + opts.icon + '</span>',
      '<div class="gf-toast__body">',
      '  <span class="gf-toast__title">' + escHtml(opts.title) + '</span>',
      textHtml,
      '</div>',
      '<button class="gf-toast__close" aria-label="Dismiss">\u00d7</button>',
      progressHtml,
    ].join('');

    document.body.appendChild(toast);

    function dismiss(el) {
      el.classList.add('gf-dismissing');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }

    toast.querySelector('.gf-toast__close').addEventListener('click', function () {
      dismiss(toast);
    });

    if (opts.timerMs) {
      var bar = toast.querySelector('.gf-toast__progress');
      if (bar) {
        bar.style.width = '100%';
        bar.style.transition = 'transform ' + opts.timerMs + 'ms linear';
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            bar.style.transform = 'scaleX(0)';
          });
        });
      }
      setTimeout(function () { dismiss(toast); }, opts.timerMs);
    }
  }

  function showSuccess(title, text, timerMs) {
    hideLoading();
    showToast({ type: 'success', icon: '\u2713', title: title || 'Success', text: text || '', timerMs: timerMs || 3000 });
  }

  function showError(title, text) {
    hideLoading();
    showToast({ type: 'error', icon: '\u2715', title: title || 'Error', text: text || 'Something went wrong \u2014 please try again.' });
  }

  /* ------------------------------------------------------------------ */
  /* Utilities                                                            */
  /* ------------------------------------------------------------------ */
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ------------------------------------------------------------------ */
  /* Export                                                               */
  /* ------------------------------------------------------------------ */
  window.GlamourFeedback = {
    showLoading: showLoading,
    hideLoading: hideLoading,
    showSuccess: showSuccess,
    showError:   showError,
  };
})();
