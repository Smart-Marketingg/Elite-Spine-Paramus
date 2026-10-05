// Tiny interactivity layer for Elite Spine homepage.

(function () {
  // Scroll-state for nav blur/condense
  const nav = document.getElementById('nav');
  if (nav) {
    const onScroll = () => {
      if (window.scrollY > 24) nav.classList.add('is-scrolled');
      else nav.classList.remove('is-scrolled');
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // FAQ accordion — single-open behavior
  const items = document.querySelectorAll('.faq__item');
  items.forEach((item) => {
    item.addEventListener('toggle', () => {
      if (item.open) {
        items.forEach((other) => { if (other !== item) other.open = false; });
      }
    });
  });

  // Mobile menu drawer
  const burger = document.getElementById('navBurger');
  const mmenu = document.getElementById('mobileMenu');
  if (burger && mmenu) {
    const openMenu = () => {
      mmenu.classList.add('is-open');
      mmenu.setAttribute('aria-hidden', 'false');
      burger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
    };
    const closeMenu = () => {
      mmenu.classList.remove('is-open');
      mmenu.setAttribute('aria-hidden', 'true');
      burger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
    };
    burger.addEventListener('click', openMenu);
    mmenu.querySelectorAll('[data-mclose]').forEach((el) => {
      el.addEventListener('click', closeMenu);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mmenu.classList.contains('is-open')) closeMenu();
    });

    // Submenu accordions (Treatments, About Us, etc.)
    mmenu.querySelectorAll('.mmenu__toggle').forEach((tgl) => {
      const group = tgl.closest('.mmenu__group');
      tgl.addEventListener('click', () => {
        const open = group.classList.toggle('is-expanded');
        tgl.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }

  // Hero play card — open video lightbox
  const play = document.querySelector('.hero__playcard');
  if (play) {
    const VIDEO_SRC = 'https://video.wixstatic.com/video/6515c6_f890feae948d4adbb62bb43a4a5d2703/1080p/mp4/file.mp4';

    const lb = document.createElement('div');
    lb.className = 'vlb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Elite Spine video');
    lb.innerHTML =
      '<div class="vlb__inner">' +
        '<button class="vlb__close" type="button" aria-label="Close video">' +
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
        '</button>' +
        '<video class="vlb__video" controls playsinline preload="metadata">' +
          '<source src="' + VIDEO_SRC + '" type="video/mp4" />' +
        '</video>' +
      '</div>';
    document.body.appendChild(lb);

    const video = lb.querySelector('.vlb__video');
    let lastFocused = null;

    const openLb = () => {
      lastFocused = document.activeElement;
      lb.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      lb.querySelector('.vlb__close').focus();
      try { video.currentTime = 0; video.play(); } catch (e) {}
    };
    const closeLb = () => {
      lb.classList.remove('is-open');
      document.body.style.overflow = '';
      video.pause();
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    };

    play.addEventListener('click', (e) => { e.preventDefault(); openLb(); });
    lb.querySelector('.vlb__close').addEventListener('click', closeLb);
    lb.addEventListener('mousedown', (e) => { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lb.classList.contains('is-open')) closeLb();
    });
  }

  // ==========================================================
  // FORMS → GOOGLE SHEET + reCAPTCHA v3
  // 1. SHEET_ENDPOINT: your Apps Script Web App URL (set below).
  // 2. RECAPTCHA_SITE_KEY: paste your reCAPTCHA v3 SITE key.
  // See SHEET-SETUP.md for the full walkthrough. reCAPTCHA stays
  // off until a site key is present; forms still work meanwhile.
  // ==========================================================
  const SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwvpP6t2vKnA2xpA-hm3JaEg4mzE7Jo9-V6d4DSAUDqXudpjNqrDIaSv1DRlalRhe8xrg/exec';
  const RECAPTCHA_SITE_KEY = '';

  // Load the reCAPTCHA v3 library once, only if a key is configured.
  if (RECAPTCHA_SITE_KEY) {
    const s = document.createElement('script');
    s.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(RECAPTCHA_SITE_KEY);
    s.async = true;
    document.head.appendChild(s);
  }

  // Resolve a fresh reCAPTCHA token for a given action (or '' if disabled).
  function getRecaptchaToken(action) {
    if (!RECAPTCHA_SITE_KEY || typeof grecaptcha === 'undefined') {
      return Promise.resolve('');
    }
    return new Promise((resolve) => {
      grecaptcha.ready(() => {
        grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action })
          .then(resolve)
          .catch(() => resolve(''));
      });
    });
  }

  // ---------- Lead source tracking (UTM + session source) ----------
  // Session = what brought the visitor this visit (sessionStorage).
  // First touch = how they first found the site (localStorage, 90 days).
  const ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid'];
  const ATTR_SESSION = 'es_attr_session';
  const ATTR_FIRST = 'es_attr_first';
  function readStore(store, key) { try { return JSON.parse(store.getItem(key) || 'null'); } catch (_) { return null; } }
  function writeStore(store, key, v) { try { store.setItem(key, JSON.stringify(v)); } catch (_) {} }
  (function captureAttribution() {
    const p = new URLSearchParams(location.search);
    const tags = {};
    ATTR_KEYS.forEach((k) => { const v = p.get(k); if (v) tags[k] = v.slice(0, 200); });
    let ref = '';
    try { if (document.referrer && new URL(document.referrer).hostname !== location.hostname) ref = document.referrer.slice(0, 300); } catch (_) {}
    let session = readStore(sessionStorage, ATTR_SESSION);
    if (!session || Object.keys(tags).length) {
      session = Object.assign({}, tags, { referrer: ref || (session && session.referrer) || '', landing_page: location.pathname, at: new Date().toISOString() });
      writeStore(sessionStorage, ATTR_SESSION, session);
    }
    const first = readStore(localStorage, ATTR_FIRST);
    if (!first || Date.now() - new Date(first.at).getTime() > 90 * 864e5) writeStore(localStorage, ATTR_FIRST, session);
  })();
  function firstTouchLabel(a) {
    if (!a) return '';
    if (a.gclid || a.gbraid || a.wbraid) return 'google / cpc (gclid)';
    if (a.utm_source || a.utm_medium) return (a.utm_source || '(none)') + ' / ' + (a.utm_medium || '(none)') + (a.utm_campaign ? ' / ' + a.utm_campaign : '');
    if (a.referrer) { try { return new URL(a.referrer).hostname.replace(/^www\./, '') + ' / referral'; } catch (_) {} }
    return '(direct)';
  }
  function appendAttribution(data) {
    const s = readStore(sessionStorage, ATTR_SESSION) || {};
    const f = readStore(localStorage, ATTR_FIRST);
    ATTR_KEYS.forEach((k) => { if (s[k]) data.append(k, s[k]); });
    data.append('referrer', s.referrer || '');
    data.append('landing_page', s.landing_page || location.pathname);
    if (f) { data.append('first_touch', firstTouchLabel(f)); data.append('first_seen', f.at || ''); }
  }

  function sendToSheet(form, token) {
    if (!SHEET_ENDPOINT) return Promise.resolve();
    const data = new URLSearchParams();
    // Tab name comes from the form's data-sheet-tab attribute
    data.append('_tab', form.getAttribute('data-sheet-tab') || 'Submissions');
    data.append('_source', location.pathname.split('/').pop() || 'index.html');
    if (token) data.append('_recaptcha', token);
    new FormData(form).forEach((value, key) => {
      if (key.charAt(0) !== '_') data.append(key, value);
    });
    appendAttribution(data);
    return fetch(SHEET_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: data.toString()
    });
  }

  // Also store the lead in the secure admin portal (Cloudflare D1 via /api/lead).
  function sendToBackend(form, token) {
    if (!/^https?:$/.test(location.protocol)) return Promise.resolve();
    const data = new URLSearchParams();
    data.append('_tab', form.getAttribute('data-sheet-tab') || 'Submissions');
    data.append('_source', location.pathname.split('/').pop() || 'index.html');
    if (token) data.append('_recaptcha', token);
    new FormData(form).forEach((value, key) => {
      if (key.charAt(0) !== '_') data.append(key, value);
    });
    appendAttribution(data);
    return fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: data.toString(),
      keepalive: true
    }).catch(() => {});
  }

  // Appointment / contact form validation (handles every form on the page)
  document.querySelectorAll('.cform__form').forEach((form) => {
    const showError = (field, msg) => {
      field.classList.add('is-invalid');
      const err = field.querySelector('[data-err]');
      if (err) err.textContent = msg;
    };
    const clearError = (field) => {
      field.classList.remove('is-invalid');
      const err = field.querySelector('[data-err]');
      if (err) err.textContent = '';
    };
    const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    const phoneOk = (v) => (v.replace(/\D/g, '').length >= 10);

    const validateField = (input) => {
      const field = input.closest('.field');
      if (!field) return true;
      const val = input.value.trim();
      if (input.hasAttribute('required') && !val) {
        showError(field, 'This field is required.');
        return false;
      }
      if (input.type === 'email' && val && !emailOk(val)) {
        showError(field, 'Please enter a valid email address.');
        return false;
      }
      if (input.type === 'tel' && val && !phoneOk(val)) {
        showError(field, 'Please enter a valid phone number.');
        return false;
      }
      clearError(field);
      return true;
    };

    form.querySelectorAll('input, select, textarea').forEach((input) => {
      input.addEventListener('blur', () => validateField(input));
      input.addEventListener('input', () => {
        const field = input.closest('.field');
        if (field && field.classList.contains('is-invalid')) validateField(input);
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
      let ok = true;
      let firstBad = null;
      inputs.forEach((input) => {
        if (!validateField(input)) { ok = false; if (!firstBad) firstBad = input; }
      });
      if (!ok) { if (firstBad) firstBad.focus(); return; }

      const btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.style.opacity = '.7'; }

      const done = () => {
        form.reset();
        window.location.href = '/thank-you';
      };
      // Get a reCAPTCHA token (no-op if not configured), then send to Sheet.
      const action = (form.getAttribute('data-sheet-tab') || 'submit').replace(/\W+/g, '_');
      getRecaptchaToken(action)
        // reCAPTCHA tokens are single-use, so each destination gets its own.
        .then((token) => getRecaptchaToken(action).then((token2) =>
          Promise.allSettled([sendToSheet(form, token), sendToBackend(form, token2)])))
        .then(done)
        .catch(done);
    });
  });

  // Live Google rating (fetched from the Apps Script Places endpoint)
  var gr = document.getElementById('googleRating');
  if (gr) {
    var endpoint = gr.getAttribute('data-review-endpoint');
    if (endpoint) {
      fetch(endpoint + '?reviews=1')
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok || !d.rating) return;
          var rating = Math.round(d.rating * 10) / 10;
          var ratingEl = gr.querySelector('[data-rating]');
          var totalEl = gr.querySelector('[data-total]');
          var starsEl = gr.querySelector('[data-stars]');
          if (ratingEl) ratingEl.textContent = rating.toFixed(1);
          if (totalEl && d.total) totalEl.textContent = '(' + d.total.toLocaleString() + ' Google Reviews)';
          if (starsEl) {
            starsEl.setAttribute('aria-label', rating + ' out of 5 stars');
            var pct = Math.max(0, Math.min(100, (rating / 5) * 100));
            // Build a clipped gold overlay of the same 5 stars for precise partial fill
            if (!starsEl.querySelector('.proof__stars-fill')) {
              var fill = document.createElement('span');
              fill.className = 'proof__stars-fill';
              fill.setAttribute('aria-hidden', 'true');
              fill.innerHTML = starsEl.innerHTML;
              starsEl.appendChild(fill);
            }
            starsEl.style.setProperty('--star-fill', pct + '%');
            starsEl.classList.add('proof__stars--partial');
          }
        })
        .catch(function () { /* keep static fallback */ });
    }
  }
})();
