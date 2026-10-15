(function () {
  'use strict';
  const A = window.Admin;
  const { $, esc, toast, ago, fmtDate } = A;
  const LEADS = [['none', 'No access'], ['view', 'View only'], ['manage', 'Manage']];
  const BLOG = [['none', 'No access'], ['write', 'Write drafts'], ['publish', 'Publish']];
  const SECTIONS = [['leads', 'Leads'], ['analytics', 'Analytics'], ['blog', 'Blog'], ['ai', 'AI Writer'], ['pipelines', 'Pipelines'], ['replies', 'Auto-replies'], ['users', 'Users']];
  const sideChips = (off, editable) => SECTIONS.map(([k, v]) => `<button type="button" class="chip chip--sm uSide${off.includes(k) ? '' : ' is-active'}" data-s="${k}" aria-pressed="${!off.includes(k)}"${editable ? '' : ' disabled'}>${v}</button>`).join('');
  const readOff = (box) => [...box.querySelectorAll('.uSide')].filter(b => !b.classList.contains('is-active')).map(b => b.dataset.s);
  const opts = (list, cur) => list.map(([k, v]) => `<option value="${k}"${cur === k ? ' selected' : ''}>${v}</option>`).join('');

  async function render() {
    const root = $('#view-users');
    root.innerHTML = `
      <div class="phead">
        <div><h1>Users &amp; Access</h1><p>Control who can sign in to this portal and what each person can see and do.</p></div>
      </div>
      <form class="card ufrm" id="uAdd" novalidate>
        <div class="ufrm__head"><strong>Add a person</strong><span>We email them an invite link to set their password. You’ll also get the link to copy.</span></div>
        <div class="ufrm__grid">
          <div class="field"><label for="uEmail">Email</label><input class="input" id="uEmail" type="email" placeholder="name@example.com" required /></div>
          <div class="field"><label for="uName">Name</label><input class="input" id="uName" placeholder="Optional" /></div>
          <div class="field"><label for="uLeads">Leads</label><select class="select" id="uLeads">${opts(LEADS, 'view')}</select>${A.me.super ? '<label class="ucheck ucheck--sm"><input type="checkbox" id="uSource" checked /><span>See lead source</span></label>' : ''}</div>
          <div class="field"><label for="uBlog">Blog</label><select class="select" id="uBlog">${opts(BLOG, 'none')}</select></div>
          ${A.me.super ? `<div class="field uside__add"><label>Sidebar sections</label><div class="uside__chips" id="uSideAdd">${sideChips([], true)}</div></div>` : ''}
          <div class="uchecks"><label class="ucheck"><input type="checkbox" id="uSetup" /><span>Can edit pipelines &amp; auto-replies</span></label><label class="ucheck"><input type="checkbox" id="uUsers" /><span>Can manage users</span></label></div>
          <button class="btn btn--primary" type="submit">Send invite</button>
        </div>
      </form>
      <div class="card" id="uList"><div class="empty">Loading…</div></div>
      <div class="legend">
        <div><strong>Leads</strong><span><b>View only:</b> read leads. <b>Manage:</b> also change stage, delete, and export CSV. <b>See lead source:</b> shows where each lead came from (ads, Google, social, campaigns). Only a super admin can turn this off.</span></div>
        <div><strong>Blog</strong><span><b>Write drafts:</b> create and edit drafts. <b>Publish:</b> also publish, schedule, edit live posts, and delete.</span></div>
        <div><strong>Setup</strong><span>Create and edit pipelines and stages, and turn auto-reply emails on or off.</span></div>
        <div><strong>Sidebar sections</strong><span>Super admins only. Switch any sidebar item off for a person (for example AI Writer or Analytics) and it disappears from their portal and is blocked on the server. Orange = visible.</span></div>
        <div><strong>Manage users</strong><span>Add and remove people and change their access. Super admins can’t be changed here.</span></div>
      </div>`;
    $('#uAdd').addEventListener('submit', add);
    if ($('#uSideAdd')) $('#uSideAdd').querySelectorAll('.uSide').forEach(b => b.addEventListener('click', () => { b.classList.toggle('is-active'); b.setAttribute('aria-pressed', b.classList.contains('is-active')); }));
    await loadList();
  }

  async function loadList() {
    let d;
    try { d = await A.api.users(); } catch (e) { toast(e.message, true); return; }
    const meEmail = A.me.email;
    const supers = d.supers.map(email => `
      <tr class="is-locked">
        <td><div class="cell-name">${esc(email === 'jullien@smartmarketingg.com' ? 'Jullien' : email)}${email === meEmail ? ' <span class="you">You</span>' : ''}</div><div class="cell-sub">${esc(email)}</div></td>
        <td colspan="4"><span class="pill pill--published">Super admin</span> <span class="cell-sub">Full access to everything</span></td>
        <td class="cell-muted">—</td><td></td>
      </tr>`).join('');
    const rows = d.users.map(u => `
      <tr data-email="${esc(u.email)}" class="has-side ${u.active ? '' : 'is-off'}">
        <td><div class="cell-name">${esc(u.name || u.email.split('@')[0])}${u.email === meEmail ? ' <span class="you">You</span>' : ''}${u.active ? '' : ' <span class="pill pill--closed">Paused</span>'}${u.joined === false || u.joined === 0 ? ' <span class="pill pill--c" style="--c:#f4c14a">Invited</span>' : ''}</div><div class="cell-sub">${esc(u.email)}</div></td>
        <td><select class="select uSel" data-k="leads">${opts(LEADS, u.leads)}</select>
          <label class="ucheck ucheck--sm"${A.me.super ? '' : ' title="Only a super admin can change this"'}><input type="checkbox" class="uSel" data-k="source"${u.source !== 0 ? ' checked' : ''}${A.me.super ? '' : ' disabled'} /><span>See lead source</span></label></td>
        <td><select class="select uSel" data-k="blog">${opts(BLOG, u.blog)}</select></td>
        <td><label class="switch" title="Can edit pipelines & auto-replies"><input type="checkbox" class="uSel" data-k="setup"${u.setup ? ' checked' : ''} /><span></span></label></td>
        <td><label class="switch" title="Can manage users"><input type="checkbox" class="uSel" data-k="users"${u.users ? ' checked' : ''} /><span></span></label></td>
        <td class="cell-muted">${!u.joined ? (u.invite_expires && new Date(u.invite_expires) > new Date() ? 'Invite expires ' + esc(fmtDate(u.invite_expires, false)) : '<span style="color:var(--red)">Invite expired</span>') : u.last_seen ? esc(ago(u.last_seen)) : 'Never signed in'}</td>
        <td class="uacts">
          ${!u.joined ? '<button class="btn btn--sm uInvite" type="button">Resend invite</button>' : ''}
          <button class="btn btn--sm uPause" type="button">${u.active ? 'Pause' : 'Resume'}</button>
          <button class="btn btn--sm btn--danger uDel" type="button"${u.email === meEmail ? ' disabled' : ''}>Remove</button>
        </td>
      </tr>
      <tr class="uside" data-side="${esc(u.email)}"><td colspan="7"><div class="uside__row"><span class="uside__label">Sidebar</span><div class="uside__chips">${sideChips(u.off || [], A.me.super)}</div>${A.me.super ? '' : '<span class="cell-sub">Only a super admin can change this</span>'}</div></td></tr>`).join('');
    $('#uList').innerHTML = `<table class="table utable"><thead><tr><th>Person</th><th>Leads</th><th>Blog</th><th>Setup</th><th>Users</th><th>Last active</th><th></th></tr></thead>
      <tbody>${supers}${rows || ''}</tbody></table>${d.users.length ? '' : '<div class="empty"><strong>No one else yet</strong>Add a person above to give them access.</div>'}`;

    $('#uList').querySelectorAll('tr[data-email]').forEach(tr => {
      const email = tr.dataset.email;
      const u = d.users.find(x => x.email === email);
      const side = $('#uList').querySelector(`tr[data-side="${CSS.escape(email)}"]`);
      const read = () => ({ off: readOff(side), name: u.name, leads: tr.querySelector('[data-k="leads"]').value, blog: tr.querySelector('[data-k="blog"]').value, source: tr.querySelector('[data-k="source"]').checked, setup: tr.querySelector('[data-k="setup"]').checked, users: tr.querySelector('[data-k="users"]').checked, active: !!u.active });
      tr.querySelectorAll('.uSel').forEach(el => el.addEventListener('change', () => save(email, read())));
      side.querySelectorAll('.uSide').forEach(b => b.addEventListener('click', () => { b.classList.toggle('is-active'); b.setAttribute('aria-pressed', b.classList.contains('is-active')); save(email, read(), (b.classList.contains('is-active') ? 'Showing ' : 'Hid ') + b.textContent); }));
      if (tr.querySelector('.uInvite')) tr.querySelector('.uInvite').onclick = async () => {
        try {
          const r = await A.api.resendInvite(email);
          window.AdminAuth.linkDialog({ title: 'New invite link', message: `A new invite was created for <b>${esc(email)}</b>. Any earlier invite link no longer works.`, url: r.inviteUrl, emailed: r.emailed, emailError: r.emailError });
          refresh();
        } catch (e) { toast(e.message, true); }
      };
      tr.querySelector('.uPause').onclick = () => save(email, { ...read(), active: !u.active }, u.active ? 'Access paused' : 'Access resumed');
      tr.querySelector('.uDel').onclick = async () => {
        if (!confirm(`Remove ${email}? They will no longer be able to sign in to the portal.`)) return;
        try { await A.api.removeUser(email); toast('Removed'); refresh(); } catch (e) { toast(e.message, true); }
      };
    });
  }

  async function save(email, u, msg) {
    try { await A.api.updateUser(email, u); toast(msg || 'Access updated'); refresh(); }
    catch (e) { toast(e.message, true); loadList(); }
  }

  async function add(e) {
    e.preventDefault();
    const u = { off: $('#uSideAdd') ? readOff($('#uSideAdd')) : [], email: $('#uEmail').value.trim(), name: $('#uName').value.trim(), leads: $('#uLeads').value, blog: $('#uBlog').value, source: $('#uSource') ? $('#uSource').checked : true, setup: $('#uSetup').checked, users: $('#uUsers').checked };
    try {
      const r = await A.api.addUser(u);
      $('#uAdd').reset();
      if ($('#uSideAdd')) $('#uSideAdd').querySelectorAll('.uSide').forEach(b => { b.classList.add('is-active'); b.setAttribute('aria-pressed', 'true'); });
      window.AdminAuth.linkDialog({ title: 'Invite created', message: `<b>${esc(u.email)}</b> can set their password and sign in with this link.`, url: r.inviteUrl, emailed: r.emailed, emailError: r.emailError });
      refresh();
    } catch (err) { toast(err.message, true); }
  }

  function refresh() { loadList(); if (window.__demoRefreshUsers) window.__demoRefreshUsers(); }

  window.AdminUsers = { render };
})();
