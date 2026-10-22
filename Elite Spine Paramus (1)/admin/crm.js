// CRM shutdown switch (super admins only). Both directions ask for the super admin's password;
// only the super admin who shut it down can turn it back on. The server enforces all of this.
(function () {
  'use strict';
  const POWER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v9"></path><path d="M6.3 6.3a8 8 0 1 0 11.4 0"></path></svg>';
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = (iso) => { try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (_) { return ''; } };

  async function put(body) {
    const r = await fetch('/api/admin/crm', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'crm' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Request failed (' + r.status + ')');
    return d;
  }

  function ask(me) {
    const off = !(me.crm && me.crm.off);
    const mine = !off && me.crm.by === me.email;
    if (!off && !mine) {
      window.AdminAuth.dialog(`<h2>CRM is shut down</h2><p>Only <b>${esc(me.crm.by)}</b> can turn it back on, with their password.</p><div class="amodal__acts"><button class="btn" type="button" id="crmClose">Close</button></div>`,
        (d) => { d.querySelector('#crmClose').onclick = window.AdminAuth.close; });
      return;
    }
    window.AdminAuth.dialog(`
      <h2>${off ? 'Shut down the CRM?' : 'Turn the CRM back on?'}</h2>
      ${off ? `<p>While it’s off:</p><ul class="crm-list">
          <li>Everyone except super admins is <b>signed out</b> and can’t sign in.</li>
          <li>Website forms keep working. Leads are <b>emailed to the clinic</b> (through the Google Sheet) but <b>not saved</b> here.</li>
          <li>Auto-reply emails and the Monday AI Writer job are <b>paused</b>.</li>
          <li>Only you can turn it back on, with your password.</li></ul>`
        : '<p>Everyone with access can sign in again, website leads are saved again, and automations resume.</p>'}
      <form class="auth__form" id="crmForm" novalidate>
        <div class="field"><label for="crmPw">Your password</label>
          <div class="pw"><input class="input" id="crmPw" type="password" autocomplete="current-password" required /><button class="pw__eye" type="button" aria-label="Show password" data-for="crmPw">Show</button></div></div>
        <p class="auth__err" role="alert" hidden></p>
        <div class="amodal__acts"><button class="btn" type="button" id="crmCancel">Cancel</button>
          <button class="btn ${off ? 'btn--danger' : 'btn--primary'}" type="submit">${off ? 'Shut down CRM' : 'Turn CRM on'}</button></div>
      </form>`, (d) => {
      d.querySelector('#crmCancel').onclick = window.AdminAuth.close;
      const f = d.querySelector('#crmForm'), err = f.querySelector('.auth__err'), btn = f.querySelector('button[type="submit"]');
      f.onsubmit = async (e) => {
        e.preventDefault(); err.hidden = true;
        const password = d.querySelector('#crmPw').value;
        if (!password) { err.textContent = 'Enter your password.'; err.hidden = false; return; }
        btn.disabled = true;
        try {
          const r = await put({ off, password });
          window.AdminAuth.close();
          me.crm = { off: r.off, by: r.by, at: r.at };
          render(me);
          window.Admin.toast(r.off ? `CRM shut down${r.signedOut ? ` · ${r.signedOut} session${r.signedOut === 1 ? '' : 's'} signed out` : ''}` : 'CRM is back on');
        } catch (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; d.querySelector('#crmPw').select(); }
      };
    });
  }

  function render(me) {
    const btn = document.getElementById('crmBtn'), bar = document.getElementById('crmBar');
    if (!btn || !bar) return;
    btn.hidden = !me.super;
    bar.hidden = !(me.crm && me.crm.off);
    if (!me.super) return;
    const off = !!(me.crm && me.crm.off);
    btn.innerHTML = POWER + `<span class="label-long">${off ? 'Turn CRM on' : 'Shut down CRM'}</span>`;
    btn.classList.toggle('nav-item--danger', !off);
    btn.onclick = () => ask(me);
    if (off) {
      bar.innerHTML = `<strong>CRM is shut down.</strong><span>Only super admins can sign in. Leads are emailed to the clinic but not saved; automations are paused. Shut down by ${esc(me.crm.by)}${me.crm.at ? ' on ' + esc(when(me.crm.at)) : ''}.</span>${me.crm.by === me.email ? '<button class="btn btn--sm btn--primary" type="button" id="crmBarOn">Turn back on</button>' : ''}`;
      const on = document.getElementById('crmBarOn'); if (on) on.onclick = () => ask(me);
    }
  }

  window.AdminCrm = { render };
})();
