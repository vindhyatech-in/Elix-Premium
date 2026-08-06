/**
 * booking.js — Service Booking app (/booking/).
 * Sibling to main.js/animations.js, not an extension of them — this page
 * has its own shell (app navbar, bottom nav, catalog, cart) that main.js
 * knows nothing about. main.js is still loaded alongside this file for the
 * bits that ARE shared (Lenis smooth scroll, theme toggle, AOS bootstrap) —
 * every main.js function that targets marketing-only elements (preloader,
 * hero navbar/drawer, carousels, accordion, lead forms) no-ops harmlessly
 * here since those elements don't exist on this page.
 *
 * State (cart/recent searches) persists to localStorage — there's
 * no backend/auth yet (see developed.md "Service Booking App", Phase 2/3).
 */
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const STATIC_URL = document.body.dataset.staticUrl || '/static/';

  const CART_KEY = 'glamour_cart';
  const RECENT_SEARCH_KEY = 'glamour_recent_searches';
  const COUPONS = { GLAM10: 0.10, WEEKDAY15: 0.15, BUNDLE20: 0.20 };

  let currentSearchQuery = '';
  let appliedCoupon = null; // module-level so booking_drawer.js's summary total can match the mini-cart's
  // Set by initQuickView() once it runs; initFloatingCart()'s Add to Cart
  // handler calls openQuickViewItem() directly for multi-variant items
  // rather than simulating a click on the card's [data-quick-view] button
  // — that simulated click was itself getting intercepted by
  // initQuickViewTouchPeek()'s capture-phase listener on touch devices
  // (it lives inside .catalog-card__media, so the "first tap just reveals
  // the pill" logic swallowed it instead of letting the modal open).
  // closeQuickView() lets that same handler auto-close the modal once its
  // own Add to Cart click has actually added the item.
  let openQuickViewItem = null;
  let closeQuickView = null;
  // Set by initFloatingCart() once it runs; exposed on window.GlamourBooking
  // as closeCartPanel so booking_drawer.js can close the mini-cart panel
  // when the booking drawer opens over it — "Proceed to Booking" lives
  // inside that panel, and opening the drawer never closed it, so it sat
  // open (just visually covered by the higher z-index drawer) the whole
  // time and reappeared the moment the drawer closed again.
  let closeCartPanel = null;

  /* ---------------------------------------------------------
   * Small shared utilities
   * ------------------------------------------------------- */
  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function formatCurrency(value) {
    return `₹${Number(value).toLocaleString('en-IN')}`;
  }

  function formatDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (!h) return `${m} min`;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  let catalogCache = null;
  function getCatalog() {
    if (!catalogCache) {
      const el = document.getElementById('catalog-data');
      catalogCache = el ? JSON.parse(el.textContent) : [];
    }
    return catalogCache;
  }

  // Module-level (not scoped to initFloatingCart) so booking_drawer.js can
  // read/clear the cart via window.GlamourBooking without duplicating this
  // logic. saveCart() dispatches an event rather than calling the floating
  // cart's render() directly — keeps the two files decoupled.
  function getCart() { return readJSON(CART_KEY, []); }
  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent('glamour:cart-changed'));
  }

  function showToast(message) {
    const stack = document.querySelector('[data-toast-stack]');
    if (!stack) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    stack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 300);
    }, 2600);
  }

  /* ---------------------------------------------------------
   * Button ripple (micro-interaction) — event delegation so it
   * works on any current or future [data-ripple] element.
   * ------------------------------------------------------- */
  function initRipple() {
    document.body.addEventListener('click', (e) => {
      if (prefersReducedMotion) return;
      const el = e.target.closest('[data-ripple]');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const span = document.createElement('span');
      span.className = 'ripple';
      span.style.width = span.style.height = `${size}px`;
      span.style.left = `${e.clientX - rect.left - size / 2}px`;
      span.style.top = `${e.clientY - rect.top - size / 2}px`;
      el.appendChild(span);
      span.addEventListener('animationend', () => span.remove());
    });
  }

  /* ---------------------------------------------------------
   * "Coming soon" stubs — Bookings, Addresses, etc. Not built
   * until Phase 2/3.
   * ------------------------------------------------------- */
  function initComingSoonStubs() {
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-coming-soon]');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      const feature = btn.dataset.comingSoon || 'This';
      showToast(`${feature} — launching soon`);
    });
  }

  /* ---------------------------------------------------------
   * Generic dropdown system — Categories / Offers / Notifications
   * / Profile. Any [data-dropdown-trigger] opens the panel named by
   * its aria-controls; several triggers (navbar + bottom nav both
   * open "profile-panel") can point at the same panel.
   * ------------------------------------------------------- */
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

  /* ---------------------------------------------------------
   * Mobile off-canvas filter sidebar, opened by the sort bar's
   * "Filters" button ([data-filters-toggle]). The bottom nav used to
   * have a second, redundant "Categories" entry point for this same
   * panel — removed since the sort-bar button is the more discoverable
   * of the two (see developed.md).
   * ------------------------------------------------------- */
  function initMobileFilters() {
    const toggles = document.querySelectorAll('[data-filters-toggle]');
    const closeBtn = document.querySelector('[data-filters-close]');
    const sidebar = document.getElementById('filter-sidebar');
    const backdrop = document.querySelector('[data-filters-backdrop]');
    if (!toggles.length || !sidebar) return;

    function open() {
      sidebar.classList.add('is-open');
      backdrop?.classList.add('is-open');
      toggles.forEach((t) => t.setAttribute('aria-expanded', 'true'));
      document.body.style.overflow = 'hidden';
    }
    function close() {
      sidebar.classList.remove('is-open');
      backdrop?.classList.remove('is-open');
      toggles.forEach((t) => t.setAttribute('aria-expanded', 'false'));
      document.body.style.overflow = '';
    }

    toggles.forEach((toggle) => toggle.addEventListener('click', open));
    closeBtn?.addEventListener('click', close);
    backdrop?.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  /* ---------------------------------------------------------
   * Catalog: filter + sort + search recompute
   * Reads every control's current state, filters/sorts the
   * embedded catalog JSON, then reorders/hides the already
   * server-rendered cards to match — no re-render of markup.
   * ------------------------------------------------------- */
  function getFilterState() {
    const typeBtn = document.querySelector('.filter-segmented__btn.is-active[data-type-value]');
    const ratingBtn = document.querySelector('.filter-segmented__btn.is-active[data-rating-value]');
    return {
      type: typeBtn?.dataset.typeValue || 'all',
      categories: Array.from(document.querySelectorAll('[data-filter-category-checkbox]:checked')).map((cb) => cb.value),
      maxPrice: Number(document.querySelector('[data-filter-price]')?.value ?? 10000),
      maxDuration: Number(document.querySelector('[data-filter-duration]')?.value ?? 300),
      minRating: Number(ratingBtn?.dataset.ratingValue || 0),
      offersOnly: document.querySelector('[data-filter-offers]')?.checked || false,
      availableOnly: document.querySelector('[data-filter-availability]')?.checked || false,
      sort: document.querySelector('[data-sort-select]')?.value || 'popularity',
      query: currentSearchQuery.trim().toLowerCase(),
    };
  }

  const SORTERS = {
    popularity: (a, b) => b.popularity_score - a.popularity_score,
    newest: (a, b, catalog) => catalog.indexOf(b) - catalog.indexOf(a),
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating,
    duration: (a, b) => a.duration_mins - b.duration_mins,
  };

  function applyCatalogState() {
    const grid = document.querySelector('[data-catalog-grid]');
    const emptyEl = document.querySelector('[data-catalog-empty]');
    const countEl = document.querySelector('[data-result-count]');
    if (!grid) return;

    const catalog = getCatalog();
    const state = getFilterState();

    let items = catalog.filter((item) => {
      if (state.type !== 'all' && item.kind !== state.type) return false;
      if (state.categories.length && !state.categories.includes(item.category)) return false;
      if (item.price > state.maxPrice) return false;
      if (item.duration_mins > state.maxDuration) return false;
      if (item.rating < state.minRating) return false;
      if (state.offersOnly && !item.discount_pct) return false;
      if (state.availableOnly && !item.available_today) return false;
      if (state.query) {
        const haystack = `${item.name} ${item.category} ${item.description}`.toLowerCase();
        if (!haystack.includes(state.query)) return false;
      }
      return true;
    });

    const sorter = SORTERS[state.sort] || SORTERS.popularity;
    items.sort((a, b) => sorter(a, b, catalog));

    const cardMap = new Map();
    grid.querySelectorAll('[data-catalog-card]').forEach((card) => cardMap.set(card.dataset.catalogId, card));
    const visibleIds = new Set(items.map((i) => i.id));

    items.forEach((item) => {
      const card = cardMap.get(item.id);
      if (!card) return;
      card.classList.remove('is-hidden');
      grid.appendChild(card);
    });
    cardMap.forEach((card, id) => { if (!visibleIds.has(id)) card.classList.add('is-hidden'); });

    if (countEl) countEl.textContent = items.length;
    if (emptyEl) emptyEl.hidden = items.length !== 0;
  }

  function initFilters() {
    const sidebar = document.getElementById('filter-sidebar');
    if (!sidebar) return;

    sidebar.querySelectorAll('[data-filter-category-checkbox]').forEach((cb) => cb.addEventListener('change', applyCatalogState));

    const priceRange = sidebar.querySelector('[data-filter-price]');
    const priceValueEl = document.querySelector('[data-price-value]');
    priceRange?.addEventListener('input', () => {
      const val = Number(priceRange.value);
      priceValueEl.textContent = val >= 10000 ? '₹10,000+' : formatCurrency(val);
      // Update the gold-fill gradient on the range track
      const pct = (val / 10000) * 100;
      priceRange.style.setProperty('--range-pct', `${pct}%`);
      applyCatalogState();
      updateFilterBadge();
    });

    const durationRange = sidebar.querySelector('[data-filter-duration]');
    const durationValueEl = document.querySelector('[data-duration-value]');
    durationRange?.addEventListener('input', () => {
      const val = Number(durationRange.value);
      durationValueEl.textContent = val >= 300 ? '5h+' : formatDuration(val);
      // Update the gold-fill gradient on the range track
      const pct = (val / 300) * 100;
      durationRange.style.setProperty('--range-pct', `${pct}%`);
      applyCatalogState();
      updateFilterBadge();
    });

    function wireSegmented(selector) {
      const group = sidebar.querySelector(selector);
      if (!group) return;
      const buttons = group.querySelectorAll('.filter-segmented__btn');
      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          buttons.forEach((b) => { b.classList.remove('is-active'); b.setAttribute('aria-checked', 'false'); });
          btn.classList.add('is-active');
          btn.setAttribute('aria-checked', 'true');
          applyCatalogState();
          updateFilterBadge();
        });
      });
    }
    wireSegmented('[data-filter-type]');
    wireSegmented('[data-filter-rating]');

    sidebar.querySelector('[data-filter-offers]')?.addEventListener('change', () => { applyCatalogState(); updateFilterBadge(); });
    sidebar.querySelector('[data-filter-availability]')?.addEventListener('change', () => { applyCatalogState(); updateFilterBadge(); });

    document.querySelector('[data-filters-clear]')?.addEventListener('click', () => {
      sidebar.querySelectorAll('[data-filter-category-checkbox]').forEach((cb) => { cb.checked = false; });
      sidebar.querySelector('[data-filter-offers]').checked = false;
      sidebar.querySelector('[data-filter-availability]').checked = false;
      if (priceRange) { priceRange.value = 10000; priceValueEl.textContent = '₹10,000+'; priceRange.style.setProperty('--range-pct', '100%'); }
      if (durationRange) { durationRange.value = 300; durationValueEl.textContent = '5h+'; durationRange.style.setProperty('--range-pct', '100%'); }
      [sidebar.querySelector('[data-filter-type]'), sidebar.querySelector('[data-filter-rating]')].forEach((group) => {
        const buttons = group?.querySelectorAll('.filter-segmented__btn') || [];
        buttons.forEach((b, i) => { b.classList.toggle('is-active', i === 0); b.setAttribute('aria-checked', String(i === 0)); });
      });
      applyCatalogState();
      updateFilterBadge();
    });
  }

  /* Count active filter selections and show/hide the badge on the Filters
   * button. Called after every filter clear / applyCatalogState that comes
   * from a filter change. */
  function updateFilterBadge() {
    const badge = document.querySelector('[data-filter-badge]');
    if (!badge) return;
    const state = getFilterState();
    let count = 0;
    if (state.type !== 'all') count++;
    count += state.categories.length;
    if (state.maxPrice < 10000) count++;
    if (state.maxDuration < 300) count++;
    if (state.minRating > 0) count++;
    if (state.offersOnly) count++;
    if (state.availableOnly) count++;
    badge.textContent = count || '';
    badge.classList.toggle('is-visible', count > 0);
  }

  function initSort() {
    const select = document.querySelector('[data-sort-select]');
    const pills = document.querySelectorAll('[data-sort-pill]');
    if (!select && !pills.length) return;

    // Choices.js is no longer used (replaced by pill buttons), but keep the
    // guard so the old CDN tag doesn't error if still present in base template.
    // if (window.Choices) { new Choices(select, { ... }); }

    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        // Update pill active state
        pills.forEach((p) => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        // Sync hidden select so getFilterState() keeps working unchanged
        if (select) {
          select.value = pill.dataset.sortPill;
          select.dispatchEvent(new Event('change'));
        } else {
          applyCatalogState();
        }
      });
    });

    // Keep hidden select as fallback change driver for any code that
    // calls select.dispatchEvent('change') directly
    select?.addEventListener('change', applyCatalogState);
  }

  // "Packages" nav shortcut + Categories dropdown items both drive the same
  // sidebar category checkboxes — one state, two entry points.
  function initNavCategoryShortcuts() {
    document.querySelectorAll('[data-filter-category]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const value = btn.dataset.filterCategory;
        const sidebar = document.getElementById('filter-sidebar');
        sidebar?.querySelectorAll('[data-filter-category-checkbox]').forEach((cb) => {
          cb.checked = value !== 'all' && cb.value === value;
        });
        applyCatalogState();
        document.querySelectorAll('[data-dropdown-panel].is-open').forEach((p) => p.classList.remove('is-open'));
        document.getElementById('catalog')?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  function checkURLCategoryParam() {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category');
    if (!cat) return;
    const sidebar = document.getElementById('filter-sidebar');
    if (!sidebar) return;

    if (cat === 'package') {
      const typeGroup = sidebar.querySelector('[data-filter-type]');
      typeGroup?.querySelectorAll('.filter-segmented__btn').forEach((b) => {
        const isActive = b.dataset.typeValue === 'package';
        b.classList.toggle('is-active', isActive);
        b.setAttribute('aria-checked', String(isActive));
      });
    } else {
      sidebar.querySelectorAll('[data-filter-category-checkbox]').forEach((cb) => {
        cb.checked = cb.value === cat;
      });
    }
    applyCatalogState();
    updateFilterBadge();
  }

  /* ---------------------------------------------------------
   * Search — debounced live filter + autosuggest (live matches,
   * recent, trending). Recent searches persist to localStorage.
   * ------------------------------------------------------- */
  function getRecentSearches() { return readJSON(RECENT_SEARCH_KEY, []); }
  function pushRecentSearch(term) {
    const list = getRecentSearches().filter((t) => t.toLowerCase() !== term.toLowerCase());
    list.unshift(term);
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(list.slice(0, 5)));
  }

  function initSearch() {
    const wrap = document.querySelector('[data-search]');
    const input = document.querySelector('[data-search-input]');
    const clearBtn = document.querySelector('[data-search-clear]');
    const panel = document.querySelector('[data-search-panel]');
    const resultsSection = document.querySelector('[data-search-results]');
    const recentSection = document.querySelector('[data-search-recent]');
    const recentTags = document.querySelector('[data-recent-tags]');
    if (!wrap || !input || !panel) return;

    function renderRecent() {
      const recent = getRecentSearches();
      if (!recent.length) { recentSection.hidden = true; return; }
      recentSection.hidden = false;
      recentTags.innerHTML = '';
      recent.forEach((term) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'search-bar__tag';
        btn.dataset.searchTag = term;
        btn.textContent = term;
        recentTags.appendChild(btn);
      });
    }

    function renderResults(query) {
      if (!query) { resultsSection.hidden = true; resultsSection.innerHTML = ''; return; }
      const q = query.toLowerCase();
      const matches = getCatalog().filter((i) => i.name.toLowerCase().includes(q)).slice(0, 5);
      resultsSection.hidden = false;
      resultsSection.innerHTML = matches.length
        ? ''
        : '<p class="search-bar__no-results">No matches. Try a different term.</p>';
      matches.forEach((item) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'search-result';
        row.innerHTML = `<img src="${STATIC_URL}${item.photo}" alt="">
          <div><p class="search-result__name">${escapeHtml(item.name)}</p>
          <p class="search-result__meta">${escapeHtml(item.category)} · ${formatCurrency(item.price)}</p></div>`;
        row.addEventListener('click', () => selectTerm(item.name));
        resultsSection.appendChild(row);
      });
    }

    function selectTerm(term) {
      input.value = term;
      pushRecentSearch(term);
      panel.hidden = true;
      clearBtn.hidden = false;
      currentSearchQuery = term;
      applyCatalogState();
    }

    const debouncedSearch = debounce(() => {
      currentSearchQuery = input.value.trim();
      renderResults(currentSearchQuery);
      applyCatalogState();
    }, 250);

    input.addEventListener('input', () => {
      clearBtn.hidden = !input.value;
      debouncedSearch();
    });

    // Enter commits the current query (filtering already happened live via
    // the input listener above) — closes the dropdown and blurs the field
    // so the on-screen keyboard dismisses on mobile instead of the input
    // just sitting there focused with nothing left to do.
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const query = input.value.trim();
      if (query) pushRecentSearch(query);
      panel.hidden = true;
      input.blur();
    });

    input.addEventListener('focus', () => {
      renderRecent();
      renderResults(input.value.trim());
      panel.hidden = false;
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.hidden = true;
      currentSearchQuery = '';
      renderResults('');
      applyCatalogState();
      input.focus();
    });

    panel.addEventListener('click', (e) => {
      const tagBtn = e.target.closest('[data-search-tag]');
      if (tagBtn) selectTerm(tagBtn.dataset.searchTag);
    });

    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) panel.hidden = true; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') panel.hidden = true; });

    renderRecent();
  }

  /* ---------------------------------------------------------
   * "Read more" for catalog card descriptions — trims the text word by
   * word (binary search) until it fits the 2-line box (see
   * .catalog-card__desc's max-height/line-height in booking.css), then
   * appends "Read more" as the last inline node of that same paragraph,
   * so it reads as a continuation of the sentence rather than a separate
   * element below it. It carries [data-quick-view] itself (see
   * catalog_card.html on the paragraph), so clicking it opens the same
   * Quick View modal as the photo.
   * ------------------------------------------------------- */
  function initDescReadMore() {
    const descs = document.querySelectorAll('[data-catalog-desc]');
    if (!descs.length) return;

    function truncate(desc) {
      const full = desc.dataset.fullDesc;
      desc.textContent = full;
      if (desc.scrollHeight <= desc.clientHeight + 1) return; // fits as-is, no button needed

      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'catalog-card__desc-more';
      more.dataset.quickView = '';
      more.dataset.catalogId = desc.dataset.catalogId;
      more.textContent = 'Read more';

      // "Read more" itself takes up inline space, so it has to be part of
      // each trial's fit test below — trimming only the description text
      // and appending the button afterwards risks pushing the button past
      // the 2-line box, where overflow:hidden would clip it invisibly.
      const words = full.split(' ');
      function setTrial(n) {
        desc.textContent = `${words.slice(0, n).join(' ')}… `;
        desc.appendChild(more);
      }

      let low = 0;
      let high = words.length;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        setTrial(mid);
        if (desc.scrollHeight <= desc.clientHeight + 1) low = mid;
        else high = mid - 1;
      }
      setTrial(low);
    }

    function check() { descs.forEach(truncate); }

    check();
    // The catalog grid is still hidden behind the loading skeleton at
    // DOMContentLoaded time (see initSkeletonReveal) — a hidden element's
    // scrollHeight/clientHeight are both 0, so this first check() always
    // finds "no overflow". Re-run once the grid is actually revealed, and
    // again on resize since a breakpoint change can change how much text
    // fits in 2 lines.
    document.addEventListener('glamour:catalog-revealed', check);
    window.addEventListener('resize', debounce(check, 200));
  }

  /* ---------------------------------------------------------
   * Quick View modal — single reusable modal populated from the
   * embedded catalog JSON per click, rather than one modal per card.
   * ------------------------------------------------------- */
  function initQuickView() {
    const modal = document.getElementById('quick-view-modal');
    const backdrop = document.querySelector('[data-modal-backdrop]');
    if (!modal || !backdrop) return;

    // Reflects whichever variant is currently selected — duration/price/
    // discount badge and the Add to Cart button's target variant all
    // follow it. For a single-variant (or variant-less, e.g. package)
    // item this just mirrors the flat item.price/duration_label fields.
    function selectVariant(item, variant) {
      const hasReviews = !!item.reviews_count;
      modal.querySelector('[data-qv-rating]').textContent = hasReviews ? `★ ${item.rating}` : '';
      modal.querySelector('[data-qv-rating]').hidden = !hasReviews;
      modal.querySelector('[data-qv-reviews]').textContent = hasReviews ? `(${item.reviews_count} reviews)` : '';
      modal.querySelector('[data-qv-reviews]').hidden = !hasReviews;
      modal.querySelector('[data-qv-dot]').hidden = !hasReviews;
      modal.querySelector('[data-qv-duration]').textContent = variant.duration_label;

      const badgesEl = modal.querySelector('[data-qv-badges]');
      badgesEl.innerHTML = '';
      (item.badges || []).forEach((b) => {
        const span = document.createElement('span');
        span.textContent = b;
        badgesEl.appendChild(span);
      });
      if (variant.discount_pct) {
        const span = document.createElement('span');
        span.textContent = `${variant.discount_pct}% OFF`;
        badgesEl.appendChild(span);
      }

      modal.querySelector('[data-qv-price]').textContent = formatCurrency(variant.price);
      modal.querySelector('[data-qv-mrp]').textContent = variant.mrp ? formatCurrency(variant.mrp) : '';
      modal.querySelector('[data-qv-add-to-cart]').dataset.variantId = variant.id ?? '';

      modal.querySelectorAll('.quick-view-modal__variant-pill').forEach((pill) => {
        pill.classList.toggle('is-active', Number(pill.dataset.variantId) === variant.id);
      });
    }

    function renderVariants(item) {
      const wrap = modal.querySelector('[data-qv-variants]');
      const list = modal.querySelector('[data-qv-variant-list]');
      const variants = item.variants || [];
      list.innerHTML = '';

      if (variants.length < 2) { wrap.hidden = true; return; }
      wrap.hidden = false;
      variants.forEach((v) => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'quick-view-modal__variant-pill';
        pill.dataset.variantId = v.id;
        pill.innerHTML = `<span class="variant-pill__label">${escapeHtml(v.label)}</span><span class="variant-pill__price">${formatCurrency(v.price)}</span>`;
        pill.addEventListener('click', () => selectVariant(item, v));
        list.appendChild(pill);
      });
    }

    function open(item) {
      modal.querySelector('[data-qv-photo]').src = `${STATIC_URL}${item.photo}`;
      modal.querySelector('[data-qv-photo]').alt = item.name;
      modal.querySelector('[data-qv-category]').textContent = item.category.charAt(0).toUpperCase() + item.category.slice(1);
      modal.querySelector('[data-qv-name]').textContent = item.name;
      modal.querySelector('[data-qv-desc]').textContent = item.description;
      modal.querySelector('[data-qv-add-to-cart]').dataset.catalogId = item.id;

      renderVariants(item);
      const variants = item.variants || [];
      const defaultVariant = variants.find((v) => v.is_default) || variants[0]
        || { id: null, price: item.price, mrp: item.mrp, duration_label: item.duration_label, discount_pct: item.discount_pct };
      selectVariant(item, defaultVariant);

      modal.hidden = false;
      backdrop.hidden = false;
      requestAnimationFrame(() => { modal.classList.add('is-open'); backdrop.classList.add('is-open'); });
      document.body.style.overflow = 'hidden';
    }

    function close() {
      modal.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(() => { modal.hidden = true; backdrop.hidden = true; }, 350);
    }

    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-quick-view]');
      if (!btn) return;
      const catId = btn.dataset.catalogId;
      if (catId && btn.tagName.toLowerCase() !== 'a') {
        window.location.href = `/service/${catId}/`;
      }
    });

    modal.querySelector('[data-modal-close]')?.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('is-open')) close(); });

    openQuickViewItem = open;
    closeQuickView = close;
  }

  /* ---------------------------------------------------------
   * Touch fallback for the Quick View pill — it only ever reveals on
   * :hover (see .catalog-card__quickview in booking.css), which real
   * touchscreens never trigger. On coarse/no-hover pointers, the first
   * tap on the photo just reveals the pill (mirrors what a mouse hover
   * would show); tapping the now-visible pill itself opens the modal.
   * Runs in the capture phase so it can intercept the tap before
   * initQuickView()'s bubble-phase click handler above sees it.
   * ------------------------------------------------------- */
  function initQuickViewTouchPeek() {
    if (isFinePointer) return;

    document.body.addEventListener('click', (e) => {
      const media = e.target.closest('.catalog-card__media');
      if (!media) {
        document.querySelectorAll('.catalog-card.is-peeking').forEach((c) => c.classList.remove('is-peeking'));
        return;
      }
      const card = media.closest('.catalog-card');
      if (!card) return;

      const alreadyPeeking = card.classList.contains('is-peeking');
      const onQuickViewBtn = !!e.target.closest('[data-quick-view]');
      if (onQuickViewBtn && alreadyPeeking) return; // let this tap open the modal normally

      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.catalog-card.is-peeking').forEach((c) => { if (c !== card) c.classList.remove('is-peeking'); });
      card.classList.toggle('is-peeking', !alreadyPeeking);
    }, true);
  }

  /* ---------------------------------------------------------
   * Persistent floating cart — localStorage cart, coupon math,
   * loyalty points, expand/collapse mini-cart panel.
   * ------------------------------------------------------- */
  function initFloatingCart() {
    const root = document.querySelector('[data-floating-cart]');
    const backdrop = document.querySelector('[data-cart-backdrop]');
    const itemsEl = document.querySelector('[data-cart-items]');
    const emptyEl = document.querySelector('[data-cart-empty]');
    const subtotalEl = document.querySelector('[data-cart-subtotal]');
    const discountRow = document.querySelector('[data-cart-discount-row]');
    const discountEl = document.querySelector('[data-cart-discount]');
    const totalEl = document.querySelector('[data-cart-total]');
    const loyaltyEl = document.querySelector('[data-cart-loyalty]');
    const couponInput = document.querySelector('[data-coupon-input]');
    const couponStatus = document.querySelector('[data-coupon-status]');
    const proceedBtn = document.querySelector('[data-proceed-to-booking]');
    if (!root || !itemsEl) return;

    // Cart lines match on (id, variantId) together, not just id — the same
    // service with two different variants selected (e.g. Honey Wax +
    // Chocolate Wax, both "Full Arms") are two separate lines, not one.
    // variantId is normalized to `null` (never undefined) so a line added
    // before variants existed, or one added from the marketing page (which
    // has no variant picker and always sends a bare {id, qty}), matches
    // consistently against the item's default variant.
    function normalizedVariantId(v) { return v === undefined || v === null || v === '' ? null : Number(v); }
    function findVariant(item, variantId) {
      return (item.variants || []).find((v) => v.id === variantId) || null;
    }
    function lineKey(id, variantId) { return `${id}::${variantId === null ? '' : variantId}`; }
    function parseLineKey(key) {
      const sep = key.lastIndexOf('::');
      return { id: key.slice(0, sep), variantId: normalizedVariantId(key.slice(sep + 2) || null) };
    }

    function render() {
      const cart = getCart();
      const catalog = getCatalog();
      itemsEl.innerHTML = '';
      let subtotal = 0;
      let count = 0;

      cart.forEach((line) => {
        const item = catalog.find((i) => i.id === line.id);
        if (!item) return;
        const variantId = normalizedVariantId(line.variantId);
        const variant = findVariant(item, variantId);
        const price = variant ? variant.price : item.price;
        // Only worth naming the variant when it was an actual choice among
        // several — catalog.py falls back to duration_label ("3h") for a
        // single-variant service's blank label, which would otherwise show
        // a meaningless "(3h)" suffix on things like packages.
        const hasRealVariants = item.variants && item.variants.length > 1;
        const name = variant && variant.label && hasRealVariants ? `${item.name} — ${variant.label}` : item.name;
        const key = lineKey(item.id, variantId);
        count += line.qty;
        subtotal += price * line.qty;

        const row = document.createElement('div');
        row.className = 'cart-line';
        row.innerHTML = `
          <img src="${STATIC_URL}${item.photo}" alt="">
          <div class="cart-line__info">
            <p class="cart-line__name">${escapeHtml(name)}</p>
            <p class="cart-line__price">${formatCurrency(price)} × ${line.qty}</p>
          </div>
          <div class="cart-line__qty">
            <button type="button" data-cart-decrement="${key}" aria-label="Decrease quantity">−</button>
            <span>${line.qty}</span>
            <button type="button" data-cart-increment="${key}" aria-label="Increase quantity">+</button>
          </div>
          <button type="button" class="cart-line__remove" data-cart-remove="${key}" aria-label="Remove ${escapeHtml(name)}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>`;
        itemsEl.appendChild(row);
      });

      emptyEl.hidden = cart.length > 0;
      itemsEl.hidden = cart.length === 0;

      const discountRate = appliedCoupon ? COUPONS[appliedCoupon] : 0;
      const discount = Math.round(subtotal * discountRate);
      const total = subtotal - discount;
      const loyaltyPoints = Math.floor(total / 100);

      subtotalEl.textContent = formatCurrency(subtotal);
      discountRow.hidden = discount <= 0;
      if (discount > 0) discountEl.textContent = `-${formatCurrency(discount)}`;
      totalEl.textContent = formatCurrency(total);
      loyaltyEl.textContent = `Earn ${loyaltyPoints} loyalty point${loyaltyPoints === 1 ? '' : 's'} on this order`;

      document.querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = count; });
      document.querySelectorAll('[data-cart-bubble-count]').forEach((el) => { el.textContent = count; });
      document.querySelectorAll('[data-cart-count-mobile]').forEach((el) => { el.hidden = count === 0; el.textContent = count; });
      document.querySelectorAll('[data-cart-toggle]').forEach((btn) => btn.setAttribute('aria-label', `Open cart, ${count} item${count === 1 ? '' : 's'}`));

      if (proceedBtn) proceedBtn.disabled = cart.length === 0;
    }

    // Does NOT open the cart panel — a toast is enough confirmation that
    // the add worked. The panel now only opens for an explicit cart-icon
    // click, or the marketing-page ?open_cart=1 handoff below; it used to
    // pop open on every single Add to Cart click anywhere in the app,
    // which was disruptive when adding several items in a row.
    function addItem(id, variantId) {
      variantId = normalizedVariantId(variantId);
      const cart = getCart();
      const line = cart.find((l) => l.id === id && normalizedVariantId(l.variantId) === variantId);
      if (line) line.qty += 1; else cart.push({ id, variantId, qty: 1 });
      saveCart(cart);
      const item = getCatalog().find((i) => i.id === id);
      const variant = item ? findVariant(item, variantId) : null;
      const hasRealVariants = item && item.variants && item.variants.length > 1;
      const label = variant && variant.label && hasRealVariants ? ` (${variant.label})` : '';
      showToast(item ? `${item.name}${label} added to cart` : 'Added to cart');
    }

    function changeQty(key, delta) {
      const { id, variantId } = parseLineKey(key);
      const cart = getCart();
      const line = cart.find((l) => l.id === id && normalizedVariantId(l.variantId) === variantId);
      if (!line) return;
      line.qty += delta;
      saveCart(line.qty <= 0 ? cart.filter((l) => l !== line) : cart);
    }

    function removeItem(key) {
      const { id, variantId } = parseLineKey(key);
      saveCart(getCart().filter((l) => !(l.id === id && normalizedVariantId(l.variantId) === variantId)));
    }

    function open() {
      root.classList.add('is-open');
      if (backdrop) backdrop.hidden = false;
      requestAnimationFrame(() => backdrop?.classList.add('is-open'));
      document.querySelectorAll('[data-cart-toggle]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
    }
    function close() {
      root.classList.remove('is-open');
      backdrop?.classList.remove('is-open');
      document.querySelectorAll('[data-cart-toggle]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      setTimeout(() => { if (backdrop) backdrop.hidden = true; }, 300);
    }
    closeCartPanel = close;

    document.querySelectorAll('[data-cart-toggle]').forEach((btn) => btn.addEventListener('click', () => {
      root.classList.contains('is-open') ? close() : open();
    }));
    document.querySelector('[data-cart-close]')?.addEventListener('click', close);
    backdrop?.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    itemsEl.addEventListener('click', (e) => {
      const inc = e.target.closest('[data-cart-increment]');
      const dec = e.target.closest('[data-cart-decrement]');
      const rem = e.target.closest('[data-cart-remove]');
      if (inc) changeQty(inc.dataset.cartIncrement, 1);
      if (dec) changeQty(dec.dataset.cartDecrement, -1);
      if (rem) removeItem(rem.dataset.cartRemove);
    });

    document.querySelector('[data-coupon-apply]')?.addEventListener('click', () => {
      const code = (couponInput.value || '').trim().toUpperCase();
      if (!code) return;
      if (COUPONS[code]) {
        appliedCoupon = code;
        couponStatus.textContent = `${code} applied — ${Math.round(COUPONS[code] * 100)}% off`;
        showToast('Coupon applied');
      } else {
        appliedCoupon = null;
        couponStatus.textContent = 'Invalid or expired code.';
      }
      render();
    });

    document.body.addEventListener('click', (e) => {
      // Quick View's own Add to Cart already has a variant picker right
      // there in the modal — data-variant-id (kept in sync by
      // initQuickView's selectVariant()) is whichever pill is selected.
      // Closes the modal afterwards — the toast from addItem() is enough
      // confirmation, and leaving it open reads as if the click did nothing.
      const qvBtn = e.target.closest('[data-qv-add-to-cart]');
      if (qvBtn) {
        const id = qvBtn.dataset.catalogId;
        if (id) addItem(id, qvBtn.dataset.variantId || null);
        closeQuickView?.();
        return;
      }

      const addBtn = e.target.closest('[data-add-to-cart]');
      if (!addBtn) return;
      const id = addBtn.dataset.catalogId;
      if (!id) return;
      const item = getCatalog().find((i) => i.id === id);
      const variants = (item && item.variants) || [];
      if (variants.length > 1) {
        // The card has no room for a picker — hand off to Quick View
        // instead of silently adding whichever variant happens to be
        // default. Calls openQuickViewItem() directly rather than
        // simulating a click on the card's [data-quick-view] button —
        // that button lives inside .catalog-card__media, where
        // initQuickViewTouchPeek()'s capture-phase listener intercepts the
        // first tap on touch devices as a "reveal the pill" gesture and
        // never lets the click reach Quick View's own open handler.
        if (item) openQuickViewItem?.(item);
        return;
      }
      addItem(id, variants[0] ? variants[0].id : null);
    });

    // booking_drawer.js clears the cart via window.GlamourBooking.saveCart([])
    // on confirm — this keeps the mini-cart panel in sync without it needing
    // to know about booking_drawer.js at all.
    window.addEventListener('glamour:cart-changed', render);

    render();

    // Arrived via a marketing-page "Book Now" / "Choose <package>" link
    // (main.js::initMarketingBookButtons adds the item, then links here
    // with ?open_cart=1) — open the mini-cart immediately so the add is
    // visible, then drop the param so a refresh doesn't reopen it.
    if (new URLSearchParams(window.location.search).get('open_cart')) {
      open();
      const url = new URL(window.location.href);
      url.searchParams.delete('open_cart');
      window.history.replaceState({}, '', url);
    }
  }

  /* ---------------------------------------------------------
   * Chat FAB — Phase 1: one scripted bot reply per message.
   * Full AI/Support/FAQ tabs are Phase 3 (see developed.md).
   * ------------------------------------------------------- */
  function initChatFab() {
    const panel = document.getElementById('chat-panel');
    const toggles = document.querySelectorAll('[data-chat-toggle]');
    const closeBtn = document.querySelector('[data-chat-close]');
    const form = document.querySelector('[data-chat-form]');
    const input = document.querySelector('[data-chat-input]');
    const messages = document.querySelector('[data-chat-messages]');
    if (!panel || !toggles.length) return;

    function appendBubble(text, who) {
      const div = document.createElement('div');
      div.className = `chat-bubble chat-bubble--${who}`;
      div.textContent = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }

    function open() {
      panel.hidden = false;
      requestAnimationFrame(() => panel.classList.add('is-open'));
      toggles.forEach((t) => t.setAttribute('aria-expanded', 'true'));
    }
    function close() {
      panel.classList.remove('is-open');
      toggles.forEach((t) => t.setAttribute('aria-expanded', 'false'));
      setTimeout(() => { panel.hidden = true; }, 350);
    }

    toggles.forEach((btn) => btn.addEventListener('click', () => {
      panel.classList.contains('is-open') ? close() : open();
    }));
    closeBtn?.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('is-open')) close(); });

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      appendBubble(text, 'user');
      input.value = '';
      setTimeout(() => {
        appendBubble("Thanks for reaching out — this is a preview experience. Full live chat is launching soon; our team will follow up shortly.", 'bot');
      }, 500);
    });
  }

  /* ---------------------------------------------------------
   * Skeleton loading → real grid swap (simulates initial fetch
   * latency, matching what a real /api/v1/services/ call would have).
   * ------------------------------------------------------- */
  function initSkeletonReveal() {
    const skeleton = document.querySelector('[data-catalog-skeleton]');
    const real = document.querySelector('[data-catalog-grid]');
    if (!skeleton || !real) return;

    const reveal = () => {
      skeleton.remove();
      real.hidden = false;
      applyCatalogState();
      initCardTilt();
      if (window.AOS) AOS.refresh();
      // Anything that measured card layout (e.g. initDescReadMore's
      // scrollHeight check) would have seen a hidden, zero-size grid if it
      // ran before this point — let it know the grid is actually visible now.
      document.dispatchEvent(new Event('glamour:catalog-revealed'));
    };

    if (prefersReducedMotion) { reveal(); return; }
    setTimeout(reveal, 550);
  }

  /* ---------------------------------------------------------
   * Subtle card tilt (pointer:fine only) — same pattern as the
   * marketing site's .service-card tilt in animations.js.
   * ------------------------------------------------------- */
  function initCardTilt() {
    if (!isFinePointer || prefersReducedMotion) return;
    document.querySelectorAll('.catalog-card').forEach((card) => {
      if (card.dataset.tiltBound) return;
      card.dataset.tiltBound = 'true';
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(900px) rotateX(${py * -3}deg) rotateY(${px * 3}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initDropdowns();
    initMobileFilters();
    initFilters();
    initSort();
    initNavCategoryShortcuts();
    checkURLCategoryParam();
    initSearch();
    initQuickView();
    initQuickViewTouchPeek();
    initDescReadMore();
    initFloatingCart();
    initChatFab();
    initComingSoonStubs();
    initRipple();
    initSkeletonReveal();
    updateFilterBadge();

    // Small shared surface for booking_drawer.js (Phase 2) — keeps "catalog
    // browsing" (this file) and "booking flow" (booking_drawer.js) as
    // separate concerns instead of one growing file. See developed.md
    // "Service Booking App" for the full rationale.
    window.GlamourBooking = {
      getCart,
      saveCart,
      getCatalog,
      formatCurrency,
      showToast,
      getAppliedDiscountRate: () => (appliedCoupon ? COUPONS[appliedCoupon] : 0),
      getAppliedCouponCode: () => appliedCoupon,
      closeCartPanel: () => closeCartPanel?.(),
    };
  });

  window.onCustomerPackageVariantChange = function(selectEl) {
    const card = selectEl.closest('.catalog-card');
    if (!card) return;
    const pkgBox = card.querySelector('.catalog-card__pkg-box');
    if (!pkgBox) return;

    const discountPct = parseFloat(pkgBox.dataset.pkgDiscount || 0);

    let totalMrp = 0;
    let totalDuration = 0;

    card.querySelectorAll('.catalog-card__pkg-variant-select').forEach(sel => {
      const selectedOpt = sel.options[sel.selectedIndex];
      if (selectedOpt) {
        totalMrp += parseFloat(selectedOpt.dataset.price || 0);
        totalDuration += parseInt(selectedOpt.dataset.duration || 0, 10);
      }
    });

    card.querySelectorAll('.catalog-card__pkg-single-val').forEach(inp => {
      totalMrp += parseFloat(inp.dataset.price || 0);
      totalDuration += parseInt(inp.dataset.duration || 0, 10);
    });

    let newPackagePrice = totalMrp;
    if (discountPct > 0) {
      newPackagePrice = Math.round(totalMrp * (1 - discountPct / 100));
    }

    const hours = Math.floor(totalDuration / 60);
    const minutes = totalDuration % 60;
    let durLabel = '';
    if (hours > 0 && minutes > 0) durLabel = `${hours}h ${minutes}m`;
    else if (hours > 0) durLabel = `${hours}h`;
    else durLabel = `${minutes} min`;

    const priceNowEl = card.querySelector('.catalog-card__price-now');
    const priceMrpEl = card.querySelector('.catalog-card__price-mrp');
    const durationEl = card.querySelector('.catalog-card__duration');

    if (priceNowEl) priceNowEl.textContent = `₹${newPackagePrice}`;
    if (priceMrpEl) priceMrpEl.textContent = `₹${totalMrp}`;
    if (durationEl) durationEl.textContent = durLabel;
  };
})();
