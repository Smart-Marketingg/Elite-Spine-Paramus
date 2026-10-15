(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LOGO = '<img src="../images/logo.svg" alt="Elite Spine &amp; Sports Care" />';
  const auth = () => window.Admin.auth;
  const isDemo = () => window.Admin && window.Admin.mode === 'demo';
  const clearLink = () => history.replaceState(null, '', location.pathname + location.search);
  const home = () => { clearLink(); location.reload(); };
  const COMMON = ['password', 'password1', 'password123', '1234567890', 'qwertyuiop', 'elitespine', 'letmein123', 'welcome123', 'paramus123'];

  function pwProblem(pw, email) {
    if (pw.length < 10) return 'Use at least 10 characters.';
    if (COMMON.includes(pw.toLowerCase())) return 'That password is too common. Pick something harder to guess.';
    const local = String(email || '').split('@')[0].toLowerCase();
    if (local.length > 3 && pw.toLowerCase().includes(local)) return 'Don’t include your email name in the password.';
    return null;
  }
  const pwField = (id, label, auto, hint) => `
    <div class="field"><label for="${id}">${label}</label>
      <div class="pw"><input class="input" id="${id}" type="password" autocomplete="${auto}" required /><button class="pw__eye" type="button" aria-label="Show password" data-for="${id}">Show</button></div>
      ${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  function wireEyes(root) {
    root.querySelectorAll('.pw__eye').forEach(b => b.onclick = () => {
      const i = $('#' + b.dataset.for); const show = i.type === 'password';
      i.type = show ? 'text' : 'password'; b.textContent = show ? 'Hide' : 'Show'; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  }
  function busy(form, on, label) {
    const b = form.querySelector('button[type="submit"]');
    if (!b.dataset.label) b.dataset.label = b.textContent;
    b.disabled = on; b.textContent = on ? (label || 'Please wait…') : b.dataset.label;
  }
  const err = (form, msg) => { const e = form.querySelector('.auth__err'); e.textContent = msg || ''; e.hidden = !msg; };

  function card(inner) {
    $('#app').hidden = true;
    const g = $('#gate'); g.hidden = false;
    g.innerHTML = `<div class="gate__card auth">${LOGO}${inner}</div>`;
    wireEyes(g);
    const f = g.querySelector('input:not([readonly])'); if (f) f.focus();
    return g;
  }
  const demoNote = (t) => isDemo() ? `<p class="auth__demo"><strong>Demo:</strong> ${t}</p>` : '';

  // ---------- screens ----------
  function login(prefill, notice) {
    const g = card(`
      <h1>Sign in</h1>
      <p>Elite Spine &amp; Sports Care team portal</p>
      ${notice ? `<p class="auth__ok">${notice}</p>` : ''}
      <form class="auth__form" id="fLogin" novalidate>
        <div class="field"><label for="aEmail">Email</label><input class="input" id="aEmail" type="email" autocomplete="username" value="${esc(prefill || '')}" required /></div>
        ${pwField('aPw', 'Password', 'current-password')}
        <div class="auth__row"><label class="ucheck"><input type="checkbox" id="aRemember" /><span>Keep me signed in for 30 days</span></label><a href="#" id="aForgot">Forgot password?</a></div>
        <p class="auth__err" role="alert" hidden></p>
        <button class="btn btn--primary auth__btn" type="submit">Sign in</button>
      </form>
      ${demoNote('sign in as <b>jullien@smartmarketingg.com</b> or <b>elitespineparamus@gmail.com</b> with any password.')}`);
    $('#aForgot').onclick = (e) => { e.preventDefault(); forgot($('#aEmail').value); };
    const f = $('#fLogin');
    if (prefill) $('#aPw').focus();
    f.onsubmit = async (e) => {
      e.preventDefault(); err(f);
      const email = $('#aEmail').value.trim(), password = $('#aPw').value;
      if (!email || !password) return err(f, 'Enter your email and password.');
      busy(f, true, 'Signing in…');
      try { await auth().login({ email, password, remember: $('#aRemember').checked }); home(); }
      catch (x) { busy(f, false); err(f, x.message); $('#aPw').select(); }
    };
    return g;
  }

  function forgot(prefill) {
    card(`
      <h1>Forgot password</h1>
      <p>Enter the email you use for the portal and we’ll send a link to choose a new password.</p>
      <form class="auth__form" id="fForgot" novalidate>
        <div class="field"><label for="fEmail">Email</label><input class="input" id="fEmail" type="email" autocomplete="username" value="${esc(prefill || '')}" required /></div>
        <p class="auth__err" role="alert" hidden></p>
        <button class="btn btn--primary auth__btn" type="submit">Send reset link</button>
      </form>
      <a class="auth__back" href="#" id="fBack">Back to sign in</a>`);
    $('#fBack').onclick = (e) => { e.preventDefault(); login($('#fEmail').value); };
    const f = $('#fForgot');
    f.onsubmit = async (e) => {
      e.preventDefault(); err(f);
      const email = $('#fEmail').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(f, 'Enter a valid email address.');
      busy(f, true, 'Sending…');
      try { const r = await auth().forgot({ email }); sent(email, r && r.demoLink); }
      catch (x) { busy(f, false); err(f, x.message); }
    };
  }

  function sent(email, demoLink) {
    card(`
      <h1>Check your email</h1>
      <p>If <b>${esc(email)}</b> has a portal account, we just sent a link to reset the password. It expires in 1 hour and works once.</p>
      <p class="auth__small">Don’t see it? Check spam, or ask your administrator to make sure your email is set up.</p>
      ${demoLink ? demoNote(`no email is sent. <a href="${esc(demoLink)}">Open the reset link</a>.`) : ''}
      <a class="auth__back" href="#" id="sBack">Back to sign in</a>`);
    $('#sBack').onclick = (e) => { e.preventDefault(); login(email); };
  }

  async function setPassword(token) {
    card('<p>Checking your link…</p>');
    let t;
    try { t = await auth().token(token); } catch (_) { t = { valid: false }; }
    if (!t.valid) {
      card(`
        <h1>This link has expired</h1>
        <p>Invite links last 7 days and reset links last 1 hour. Each one works only once.</p>
        <p class="auth__small">If you were invited, ask your administrator to resend the invite. Otherwise request a new reset link.</p>
        <button class="btn btn--primary auth__btn" id="xForgot" type="button">Request a new reset link</button>
        <a class="auth__back" href="#" id="xBack">Back to sign in</a>`);
      $('#xForgot').onclick = () => { clearLink(); forgot(); };
      $('#xBack').onclick = (e) => { e.preventDefault(); clearLink(); login(); };
      return;
    }
    const invite = t.kind === 'invite';
    card(`
      <h1>${invite ? 'Join the team portal' : 'Choose a new password'}</h1>
      <p>${invite ? 'You’ve been invited to the Elite Spine &amp; Sports Care team portal. Set a password to finish.' : 'Pick a new password for your portal account. You’ll be signed out everywhere else.'}</p>
      <form class="auth__form" id="fSet" novalidate>
        <div class="field"><label for="sEmail">Email</label><input class="input" id="sEmail" type="email" autocomplete="username" value="${esc(t.email)}" readonly /></div>
        ${invite ? `<div class="field"><label for="sName">Your name</label><input class="input" id="sName" autocomplete="name" value="${esc(t.name)}" maxlength="80" /></div>` : ''}
        ${pwField('sPw', invite ? 'Create a password' : 'New password', 'new-password', 'At least 10 characters. A short phrase is easiest to remember.')}
        ${pwField('sPw2', 'Confirm password', 'new-password')}
        <p class="auth__err" role="alert" hidden></p>
        <button class="btn btn--primary auth__btn" type="submit">${invite ? 'Create account and sign in' : 'Save password and sign in'}</button>
      </form>`);
    const f = $('#fSet');
    f.onsubmit = async (e) => {
      e.preventDefault(); err(f);
      const pw = $('#sPw').value;
      const p = pwProblem(pw, t.email);
      if (p) { err(f, p); return $('#sPw').focus(); }
      if (pw !== $('#sPw2').value) { err(f, 'The two passwords don’t match.'); return $('#sPw2').focus(); }
      busy(f, true, 'Saving…');
      try { await auth().accept({ token, password: pw, name: invite ? $('#sName').value.trim() : undefined }); home(); }
      catch (x) { busy(f, false); err(f, x.message); }
    };
  }

  function noaccess(email) {
    card(`
      <h1>No access yet</h1>
      <p>${email ? esc(email) + ' is signed in but doesn’t have access. ' : ''}Ask your administrator to add you under Users &amp; Access.</p>
      <button class="btn btn--primary auth__btn" id="nOut" type="button">Sign in with a different account</button>`);
    $('#nOut').onclick = async () => { try { await auth().logout(); } catch (_) {} login(); };
  }

  // ---------- small dialog (used for change password + invite links) ----------
  function dialog(html, onMount) {
    close();
    const d = document.createElement('div');
    d.className = 'amodal'; d.id = 'amodal';
    d.innerHTML = `<div class="amodal__card" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(d);
    d.addEventListener('click', (e) => { if (e.target === d) close(); });
    document.addEventListener('keydown', escClose);
    wireEyes(d);
    if (onMount) onMount(d);
    const f = d.querySelector('input,button'); if (f) f.focus();
    return d;
  }
  function escClose(e) { if (e.key === 'Escape') close(); }
  function close() { const d = $('#amodal'); if (d) d.remove(); document.removeEventListener('keydown', escClose); }

  function changePassword(hasPassword, email) {
    dialog(`
      <h2>${hasPassword ? 'Change password' : 'Set a password'}</h2>
      <p>${hasPassword ? 'You’ll stay signed in here and be signed out on other devices.' : 'Set a password so you can sign in with your email and password.'}</p>
      <form class="auth__form" id="fChange" novalidate>
        ${hasPassword ? pwField('cCur', 'Current password', 'current-password') : ''}
        ${pwField('cNew', 'New password', 'new-password', 'At least 10 characters.')}
        ${pwField('cNew2', 'Confirm new password', 'new-password')}
        <p class="auth__err" role="alert" hidden></p>
        <div class="amodal__acts"><button class="btn" type="button" id="cCancel">Cancel</button><button class="btn btn--primary" type="submit">Save password</button></div>
      </form>`, (d) => {
      $('#cCancel', d).onclick = close;
      const f = $('#fChange', d);
      f.onsubmit = async (e) => {
        e.preventDefault(); err(f);
        const next = $('#cNew', d).value;
        const p = pwProblem(next, email);
        if (p) return err(f, p);
        if (next !== $('#cNew2', d).value) return err(f, 'The two passwords don’t match.');
        busy(f, true, 'Saving…');
        try { await window.Admin.api.changePassword({ current: hasPassword ? $('#cCur', d).value : '', next }); close(); window.Admin.toast('Password updated'); }
        catch (x) { busy(f, false); err(f, x.message); }
      };
    });
  }

  function linkDialog({ title, message, url, emailed, emailError }) {
    dialog(`
      <h2>${esc(title)}</h2>
      <p>${message}</p>
      ${emailed ? '<p class="auth__ok">Invite email sent.</p>' : `<p class="auth__warn">${emailError ? 'The email wasn’t sent: ' + esc(emailError) + ' ' : ''}Copy the link below and send it to them yourself.</p>`}
      <div class="copyrow"><input class="input" id="lnk" value="${esc(url)}" readonly /><button class="btn btn--primary" type="button" id="lnkCopy">Copy link</button></div>
      <p class="auth__small">The link expires in 7 days and works once. Sending a new invite cancels this one.</p>
      <div class="amodal__acts"><button class="btn" type="button" id="lnkDone">Done</button></div>`, (d) => {
      $('#lnkDone', d).onclick = close;
      $('#lnkCopy', d).onclick = async () => {
        const i = $('#lnk', d); i.select();
        try { await navigator.clipboard.writeText(i.value); } catch (_) { document.execCommand('copy'); }
        $('#lnkCopy', d).textContent = 'Copied';
      };
    });
  }

  function show(o) {
    o = o || {};
    if (o.screen === 'set') return setPassword(o.token);
    if (o.screen === 'noaccess') return noaccess(o.email);
    if (o.screen === 'forgot') return forgot();
    return login('', o.notice);
  }

  window.AdminAuth = { show, changePassword, linkDialog, dialog, close };
})();
