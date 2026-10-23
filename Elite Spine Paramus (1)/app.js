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
  // FORMS → CRM (/api/lead on this Worker) + Google Sheet backup
  // Spam protection is Cloudflare Turnstile. The site key comes from
  // /api/config (TURNSTILE_SITE_KEY in wrangler.jsonc); nothing to paste
  // here. Until a key exists, forms work without the widget.
  // SHEET_ENDPOINT keeps the old Apps Script copy; set it to '' to stop it.
  // ==========================================================
  const SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwvpP6t2vKnA2xpA-hm3JaEg4mzE7Jo9-V6d4DSAUDqXudpjNqrDIaSv1DRlalRhe8xrg/exec';
  const onHttp = /^https?:$/.test(location.protocol);

  // Honeypot: a field real visitors never see or fill. Bots that fill every input trip it.
  document.querySelectorAll('.cform__form').forEach((form) => {
    if (form.querySelector('[name="website"]')) return;
    const wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;';
    wrap.innerHTML = '<label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label>';
    form.appendChild(wrap);
  });

  // Turnstile: load the script only when a site key is configured, render one
  // always-visible widget per form (above the submit button). It verifies as soon
  // as the page loads; submit waits for its token if the visitor is faster.
  let turnstileKey = null;              // null = not known yet, '' = disabled
  const widgets = new WeakMap();        // form -> widget id
  const configReady = onHttp && document.querySelector('.cform__form')
    ? fetch('/api/config', { headers: { Accept: 'application/json' } }).then((r) => r.ok ? r.json() : {}).catch(() => ({}))
        .then((c) => { turnstileKey = (c && c.turnstile_site_key) || ''; if (turnstileKey) loadTurnstile(); })
    : Promise.resolve().then(() => { turnstileKey = ''; });

  function loadTurnstile() {
    if (document.getElementById('cf-turnstile-js')) return;
    window.__esTurnstileReady = () => {
      document.querySelectorAll('.cform__form').forEach((form) => {
        if (widgets.has(form)) return;
        const host = document.createElement('div');
        host.className = 'cform__turnstile';
        const btn = form.querySelector('button[type="submit"]');
        if (btn) btn.parentNode.insertBefore(host, btn); else form.appendChild(host);
        try {
          widgets.set(form, window.turnstile.render(host, {
            sitekey: turnstileKey, size: 'flexible', appearance: 'always', theme: 'dark', 'response-field': false,
            'expired-callback': () => { try { window.turnstile.reset(widgets.get(form)); } catch (_) {} }
          }));
        } catch (_) { /* leave the form usable */ }
      });
    };
    const s = document.createElement('script');
    s.id = 'cf-turnstile-js';
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__esTurnstileReady&render=explicit';
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  }

  // Resolve a Turnstile token for this form ('' when Turnstile is off or unavailable).
  function getTurnstileToken(form) {
    return configReady.then(() => {
      const id = widgets.get(form);
      if (!turnstileKey || id === undefined || !window.turnstile) return '';
      // The widget runs on its own; wait up to 20s for its token (longer if a challenge is showing).
      return new Promise((resolve) => {
        const started = Date.now();
        const poll = () => {
          let t = '';
          try { t = window.turnstile.getResponse(id) || ''; } catch (_) { t = ''; }
          if (t) return resolve(t);
          if (Date.now() - started > 20000) return resolve('');
          setTimeout(poll, 250);
        };
        poll();
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

  function formBody(form) {
    const data = new URLSearchParams();
    // Form name comes from the form's data-sheet-tab attribute (also the CRM "form" label)
    data.append('_tab', form.getAttribute('data-sheet-tab') || 'Submissions');
    data.append('_source', location.pathname.split('/').pop() || 'index.html');
    new FormData(form).forEach((value, key) => {
      if (key.charAt(0) !== '_' && key !== 'website') data.append(key, value);
    });
    appendAttribution(data);
    return data;
  }

  // Backup copy in the Google Sheet (fire and forget; no token, no honeypot).
  function sendToSheet(form) {
    if (!SHEET_ENDPOINT) return Promise.resolve();
    return fetch(SHEET_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: formBody(form).toString()
    }).catch(() => {});
  }

  // The CRM (Cloudflare D1 via /api/lead): emails the clinic and runs auto-replies.
  // Resolves { ok, error, message } so the form can show a real error.
  function sendToBackend(form, token) {
    if (!onHttp) return Promise.resolve({ ok: true, skipped: true });
    const data = formBody(form);
    const hp = form.querySelector('[name="website"]');
    if (hp && hp.value) data.append('website', hp.value);
    if (token) data.append('cf-turnstile-response', token);
    return fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', Accept: 'application/json', 'X-Requested-With': 'crm' },
      body: data.toString(),
      keepalive: true
    }).then((r) => r.json().catch(() => ({ ok: r.ok })).then((d) => Object.assign({ ok: r.ok }, d)))
      .catch(() => ({ ok: false, error: 'network' }));
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
      const fail = (msg) => {
        if (btn) { btn.disabled = false; btn.style.opacity = ''; }
        let note = form.querySelector('.cform__note');
        if (!note) { note = document.createElement('p'); note.className = 'cform__note field__err'; note.setAttribute('role', 'alert'); note.style.display = 'block'; form.appendChild(note); }
        note.textContent = msg;
        const id = widgets.get(form);
        if (id !== undefined && window.turnstile) { try { window.turnstile.reset(id); } catch (_) {} }
      };
      // Turnstile token (empty when Turnstile is off), then CRM + Sheet backup.
      getTurnstileToken(form)
        .then((token) => Promise.all([sendToBackend(form, token), sendToSheet(form)]))
        .then(([res]) => {
          if (res.ok) return done();
          if (res.error === 'turnstile') return fail('Please complete the verification and try again.');
          if (res.error === 'rate_limited') return fail(res.message || 'Too many submissions. Please try again in a few minutes.');
          if (res.error === 'contact required') return fail(res.message || 'Add a phone number or email so we can reach you.');
          // Any other CRM failure: the Sheet backup still emailed the clinic, so don't strand the visitor.
          if (SHEET_ENDPOINT) return done();
          fail('Something went wrong sending your request. Please call us at (201) 483-6653.');
        })
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
