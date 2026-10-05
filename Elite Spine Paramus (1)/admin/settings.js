(function () {
  'use strict';
  const A = window.Admin;
  const { $, esc, toast, ago, fmtDate } = A;
  const PALETTE = [['#ff6a1a', 'Orange'], ['#6aa7ff', 'Blue'], ['#4cc38a', 'Green'], ['#f4c14a', 'Gold'], ['#b48cff', 'Purple'], ['#ff6b6b', 'Red'], ['#95a0b3', 'Gray']];
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const ARROW_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"></path></svg>';
  const ARROW_DN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>';
  const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path></svg>';

  let dirty = false;
  window.AdminSettingsGuard = () => !dirty || confirm('You have unsaved changes. Leave without saving?');
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ====================== PIPELINES ======================
  const P = { list: [], forms: [], saved: '' };

  async function renderPipelines() {
    const root = $('#view-pipelines');
    root.innerHTML = '<div class="empty">Loading…</div>';
    let d;
    try { d = await A.api.pipelines(); } catch (e) { toast(e.message, true); return; }
    P.list = clone(d.pipelines); P.forms = d.forms; P.saved = JSON.stringify(P.list);
    P.keys = new Set(P.list.flatMap(p => p.stages.map(s => s.key)));
    dirty = false;
    drawPipelines();
  }

  function markDirty() {
    dirty = JSON.stringify(P.list) !== P.saved;
    const b = $('#pipeSave'); if (b) b.disabled = !dirty;
    const n = $('#pipeNote'); if (n) n.textContent = dirty ? 'Unsaved changes' : 'All changes saved';
  }

  function drawPipelines() {
    const root = $('#view-pipelines');
    const taken = {};
    P.list.forEach(p => { if (!p.default) p.forms.forEach(f => { taken[f] = p.id; }); });
    root.innerHTML = `
      <div class="phead">
        <div><h1>Pipelines</h1><p>Set the stages your team moves leads through. Each form feeds one pipeline.</p></div>
        <div class="phead__actions">
          <span class="save-note" id="pipeNote">All changes saved</span>
          <button class="btn" id="pipeAdd" type="button">Add pipeline</button>
          <button class="btn btn--primary" id="pipeSave" type="button" disabled>Save changes</button>
        </div>
      </div>
      <div class="pipes">${P.list.map((p, pi) => `
        <section class="card pipe" data-pi="${pi}">
          <div class="pipe__head">
            <input class="input pipe__name" data-k="name" value="${esc(p.name)}" aria-label="Pipeline name" maxlength="60" />
            ${p.default ? '<span class="pill pill--c" style="--c:#4cc38a">Default</span>' : `<button class="btn btn--sm" data-act="default" type="button">Make default</button><button class="btn btn--sm btn--danger" data-act="del" type="button">Delete</button>`}
          </div>
          <div class="pipe__forms">
            <p class="sec-label">Forms in this pipeline</p>
            ${p.default ? '<p class="meta-note" style="margin:0">Catches every form that isn’t assigned to another pipeline.</p>'
              : P.forms.length ? `<div class="chips">${P.forms.map(f => {
                const mine = p.forms.includes(f), other = taken[f] && taken[f] !== p.id;
                return `<button type="button" class="chip${mine ? ' is-active' : ''}" data-form="${esc(f)}"${other ? ' disabled title="Assigned to another pipeline"' : ''}>${esc(f)}</button>`;
              }).join('')}</div>` : '<p class="meta-note" style="margin:0">Forms appear here after their first submission.</p>'}
          </div>
          <p class="sec-label">Stages</p>
          <ol class="stages">${p.stages.map((s, si) => `
            <li class="stage" data-si="${si}">
              <span class="stage__n">${si + 1}</span>
              <label class="swatch" style="--c:${esc(s.color)}" title="Color"><select data-k="color" aria-label="Stage color">${PALETTE.map(([c, n]) => `<option value="${c}"${s.color === c ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
              <input class="input" data-k="label" value="${esc(s.label)}" aria-label="Stage name" maxlength="40" />
              <div class="stage__acts">
                <button class="icon-btn" data-act="up" type="button" aria-label="Move up"${si ? '' : ' disabled'}>${ARROW_UP}</button>
                <button class="icon-btn" data-act="down" type="button" aria-label="Move down"${si < p.stages.length - 1 ? '' : ' disabled'}>${ARROW_DN}</button>
                <button class="icon-btn" data-act="rm" type="button" aria-label="Remove stage"${p.stages.length > 1 ? '' : ' disabled'}>${TRASH}</button>
              </div>
            </li>`).join('')}</ol>
          <div class="pipe__foot">
            <button class="btn btn--sm" data-act="addstage" type="button"${p.stages.length >= 12 ? ' disabled' : ''}>Add stage</button>
            <span class="meta-note" style="margin:0">New leads start in stage 1. Leads in a removed stage move to stage 1.</span>
          </div>
        </section>`).join('')}</div>`;

    $('#pipeAdd').onclick = () => {
      if (P.list.length >= 10) return toast('Up to 10 pipelines.', true);
      P.list.push({ id: '', name: 'New pipeline', default: false, forms: [], stages: [{ key: 'new', label: 'New', color: '#ff6a1a' }, { key: 'contacted', label: 'Contacted', color: '#6aa7ff' }, { key: 'won', label: 'Won', color: '#4cc38a' }, { key: 'lost', label: 'Lost', color: '#95a0b3' }] });
      drawPipelines(); markDirty();
      const last = root.querySelector('.pipe:last-child .pipe__name'); if (last) { last.focus(); last.select(); }
    };
    $('#pipeSave').onclick = savePipelines;

    root.querySelectorAll('.pipe').forEach(card => {
      const p = P.list[+card.dataset.pi];
      card.querySelector('.pipe__name').addEventListener('input', (e) => { p.name = e.target.value; markDirty(); });
      card.querySelectorAll('[data-form]').forEach(b => b.addEventListener('click', () => {
        const f = b.dataset.form;
        p.forms = p.forms.includes(f) ? p.forms.filter(x => x !== f) : p.forms.concat(f);
        drawPipelines(); markDirty();
      }));
      card.querySelectorAll('.stage').forEach(li => {
        const si = +li.dataset.si, s = p.stages[si];
        li.querySelector('[data-k="label"]').addEventListener('input', (e) => { s.label = e.target.value; if (!P.keys.has(s.key) || s.key.startsWith('stage-')) s.key = slug(e.target.value) || s.key; markDirty(); });
        li.querySelector('[data-k="color"]').addEventListener('change', (e) => { s.color = e.target.value; li.querySelector('.swatch').style.setProperty('--c', s.color); markDirty(); });
        li.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
          const a = b.dataset.act;
          if (a === 'up' || a === 'down') { const j = a === 'up' ? si - 1 : si + 1; [p.stages[si], p.stages[j]] = [p.stages[j], p.stages[si]]; }
          if (a === 'rm') p.stages.splice(si, 1);
          drawPipelines(); markDirty();
        }));
      });
      card.querySelectorAll(':scope > .pipe__head [data-act], :scope > .pipe__foot [data-act]').forEach(b => b.addEventListener('click', () => {
        const a = b.dataset.act;
        if (a === 'default') { P.list.forEach(x => { x.default = x === p; }); p.forms = []; }
        if (a === 'del') { if (!confirm(`Delete “${p.name}”? Its forms go back to the default pipeline.`)) return; P.list.splice(P.list.indexOf(p), 1); }
        if (a === 'addstage') p.stages.push({ key: 'stage-' + (p.stages.length + 1), label: '', color: PALETTE[p.stages.length % PALETTE.length][0] });
        drawPipelines(); markDirty();
        if (a === 'addstage') { const inp = root.querySelector(`.pipe[data-pi="${P.list.indexOf(p)}"] .stage:last-child [data-k="label"]`); if (inp) inp.focus(); }
      }));
    });
    markDirty();
  }

  async function savePipelines() {
    const out = P.list.map(p => ({ id: p.id || slug(p.name), name: p.name.trim(), default: !!p.default, forms: p.forms, stages: p.stages.map(s => ({ key: s.key || slug(s.label), label: s.label.trim(), color: s.color })) }));
    const btn = $('#pipeSave'); btn.disabled = true;
    try {
      const r = await A.api.savePipelines(out);
      P.list = clone(r.pipelines); P.saved = JSON.stringify(P.list); dirty = false;
      P.keys = new Set(P.list.flatMap(p => p.stages.map(s => s.key)));
      toast(r.moved ? `Saved. ${r.moved} lead${r.moved === 1 ? '' : 's'} moved to stage 1.` : 'Pipelines saved');
      drawPipelines();
    } catch (e) { toast(e.message, true); btn.disabled = false; }
  }

  // ====================== AUTO-REPLIES ======================
  const R = { rules: [], pipes: [], forms: [], mailReady: false, from: '', editing: null };
  const VARS = [['first_name', 'First name'], ['name', 'Full name'], ['service', 'Interest'], ['form', 'Form name'], ['clinic_phone', 'Clinic phone'], ['booking_link', 'Booking link']];
  const SAMPLE = { name: 'Alex Sample', service: 'Lower Back Pain', form: 'Appointment Requests' };

  function trigText(r) {
    if (r.trigger === 'stage') {
      const p = R.pipes.find(x => x.id === r.pipeline);
      const s = p && p.stages.find(x => x.key === r.stage);
      return p && s ? `When a lead in ${p.name} moves to <b>${esc(s.label)}</b>` : '<span class="warn">Stage no longer exists. Edit to fix.</span>';
    }
    return r.forms.length ? `When ${r.forms.map(f => '<b>' + esc(f) + '</b>').join(', ')} is submitted` : 'When <b>any form</b> is submitted';
  }

  async function renderReplies() {
    const root = $('#view-replies');
    root.innerHTML = '<div class="empty">Loading…</div>';
    try {
      const [rr, pp] = await Promise.all([A.api.replies(), A.api.pipelines()]);
      Object.assign(R, { rules: rr.rules, mailReady: rr.mailReady, from: rr.from, pipes: pp.pipelines, forms: pp.forms, editing: null });
    } catch (e) { toast(e.message, true); return; }
    dirty = false;
    drawReplies();
  }

  function drawReplies() {
    if (R.editing) return drawEditor();
    const root = $('#view-replies');
    root.innerHTML = `
      <div class="phead">
        <div><h1>Auto-replies</h1><p>Emails that go out to the lead automatically when they submit a form or reach a stage.</p></div>
        <div class="phead__actions"><button class="btn btn--primary" id="arNew" type="button">New auto-reply</button></div>
      </div>
      ${R.mailReady ? `<div class="notice notice--ok"><strong>Email sending is on.</strong> Replies send from ${esc(R.from)}.</div>`
        : `<div class="notice"><strong>Email sending isn’t connected yet.</strong> Rules are saved and logged on each lead, but nothing is emailed until <code>RESEND_API_KEY</code> is added (see ADMIN-SETUP.md).</div>`}
      <div class="rules">${R.rules.length ? R.rules.map(r => `
        <article class="card rule${r.enabled ? '' : ' is-off'}" data-id="${r.id}">
          <label class="switch" title="${r.enabled ? 'On' : 'Off'}"><input type="checkbox" class="arToggle"${r.enabled ? ' checked' : ''} aria-label="Turn ${esc(r.name)} on or off" /><span></span></label>
          <div class="rule__main">
            <strong>${esc(r.name)}</strong>
            <span class="rule__trig">${trigText(r)}</span>
            <span class="cell-sub">Subject: ${esc(A.renderTemplate(r.subject, SAMPLE))}</span>
          </div>
          <div class="rule__stats"><b>${r.sent30 || 0}</b><span>sent in 30 days</span>${r.lastSent ? `<span>Last ${esc(ago(r.lastSent))}</span>` : ''}</div>
          <div class="rule__acts"><button class="btn btn--sm arEdit" type="button">Edit</button><button class="btn btn--sm btn--danger arDel" type="button">Delete</button></div>
        </article>`).join('') : '<div class="card empty"><strong>No auto-replies yet</strong>Create one to thank leads instantly or confirm a booking.</div>'}
      </div>
      <p class="meta-note">Each address gets at most 3 automatic emails a day, and a stage email is only sent once per lead. Don’t put health details in these emails; lead messages are never inserted.</p>`;
    $('#arNew').onclick = () => { R.editing = { name: '', enabled: true, trigger: 'submit', forms: [], pipeline: (R.pipes.find(p => p.default) || R.pipes[0]).id, stage: '', subject: '', body: 'Hi {{first_name}},\n\n\n\nElite Spine & Sports Care\n{{clinic_phone}}', reply_to: '' }; drawEditor(); };
    root.querySelectorAll('.rule').forEach(card => {
      const r = R.rules.find(x => x.id === +card.dataset.id);
      card.querySelector('.arToggle').addEventListener('change', async (e) => {
        try { await A.api.saveReply({ ...r, enabled: e.target.checked }); r.enabled = e.target.checked; card.classList.toggle('is-off', !r.enabled); toast(r.enabled ? 'Auto-reply on' : 'Auto-reply off'); }
        catch (err) { e.target.checked = !e.target.checked; toast(err.message, true); }
      });
      card.querySelector('.arEdit').onclick = () => { R.editing = clone(r); drawEditor(); };
      card.querySelector('.arDel').onclick = async () => {
        if (!confirm(`Delete “${r.name}”?`)) return;
        try { await A.api.deleteReply(r.id); toast('Deleted'); renderReplies(); } catch (e) { toast(e.message, true); }
      };
    });
  }

  function drawEditor() {
    const r = R.editing;
    const root = $('#view-replies');
    const pipeOpts = R.pipes.map(p => `<option value="${esc(p.id)}"${r.pipeline === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    const curPipe = R.pipes.find(p => p.id === r.pipeline) || R.pipes[0];
    if (!curPipe.stages.some(s => s.key === r.stage)) r.stage = (curPipe.stages[1] || curPipe.stages[0]).key;
    root.innerHTML = `
      <div class="phead">
        <div><h1>${r.id ? 'Edit auto-reply' : 'New auto-reply'}</h1><p>Use the variable buttons to personalize the email.</p></div>
        <div class="phead__actions">
          <button class="btn" id="arCancel" type="button">Cancel</button>
          <button class="btn" id="arTest" type="button">Send test to me</button>
          <button class="btn btn--primary" id="arSave" type="button">Save auto-reply</button>
        </div>
      </div>
      <div class="ared">
        <div class="card ared__form">
          <div class="field"><label for="arName">Name <em>Only your team sees this</em></label><input class="input" id="arName" value="${esc(r.name)}" maxlength="80" placeholder="e.g. Thanks for reaching out" /></div>
          <div class="field"><label>Send when</label>
            <div class="seg" id="arTrig"><button type="button" data-t="submit" class="${r.trigger === 'submit' ? 'is-active' : ''}">A form is submitted</button><button type="button" data-t="stage" class="${r.trigger === 'stage' ? 'is-active' : ''}">A lead reaches a stage</button></div>
          </div>
          ${r.trigger === 'submit' ? `<div class="field"><label>Which forms <em>${r.forms.length ? r.forms.length + ' selected' : 'All forms'}</em></label>
            <div class="chips">${R.forms.length ? R.forms.map(f => `<button type="button" class="chip${r.forms.includes(f) ? ' is-active' : ''}" data-form="${esc(f)}">${esc(f)}</button>`).join('') : '<span class="meta-note" style="margin:0">Forms appear after their first submission. Leave empty to send for every form.</span>'}</div></div>`
          : `<div class="ared__row"><div class="field"><label for="arPipe">Pipeline</label><select class="select" id="arPipe">${pipeOpts}</select></div>
            <div class="field"><label for="arStage">Stage</label><select class="select" id="arStage">${curPipe.stages.map(s => `<option value="${esc(s.key)}"${r.stage === s.key ? ' selected' : ''}>${esc(s.label)}</option>`).join('')}</select></div></div>`}
          <div class="field"><label for="arSubj">Subject</label><input class="input" id="arSubj" value="${esc(r.subject)}" maxlength="200" /></div>
          <div class="field"><label for="arBody">Message</label>
            <div class="vars">${VARS.map(([k, n]) => `<button type="button" class="chip chip--sm" data-var="${k}">${n}</button>`).join('')}</div>
            <textarea class="textarea" id="arBody" rows="12">${esc(r.body)}</textarea></div>
          <div class="field"><label for="arReply">Replies go to <em>Optional</em></label><input class="input" id="arReply" type="email" value="${esc(r.reply_to || '')}" placeholder="elitespineparamus@gmail.com" /></div>
          <label class="ucheck"><input type="checkbox" id="arOn"${r.enabled ? ' checked' : ''} /><span>Turned on</span></label>
        </div>
        <div class="ared__prev">
          <p class="sec-label">Preview with a sample lead</p>
          <div class="mail">
            <div class="mail__meta"><span>From</span><b>${esc(R.from || 'Elite Spine & Sports Care')}</b><span>To</span><b>alex.sample@example.com</b><span>Subject</span><b id="pvSubj"></b></div>
            <div class="mail__body" id="pvBody"></div>
          </div>
        </div>
      </div>`;
    const lastField = { el: null };
    const preview = () => {
      $('#pvSubj').textContent = A.renderTemplate(r.subject, SAMPLE) || '(no subject)';
      $('#pvBody').innerHTML = esc(A.renderTemplate(r.body, SAMPLE)).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('') +
        '<p class="mail__foot">Elite Spine &amp; Sports Care · 37 W Century Rd, Paramus, NJ 07652 · (201) 483-6653</p>';
    };
    const bind = (id, k) => { const el = $(id); el.addEventListener('input', () => { r[k] = el.value; dirty = true; preview(); }); el.addEventListener('focus', () => { lastField.el = el; }); };
    bind('#arName', 'name'); bind('#arSubj', 'subject'); bind('#arBody', 'body'); bind('#arReply', 'reply_to');
    $('#arOn').onchange = (e) => { r.enabled = e.target.checked; dirty = true; };
    root.querySelectorAll('#arTrig button').forEach(b => b.onclick = () => { r.trigger = b.dataset.t; dirty = true; drawEditor(); });
    root.querySelectorAll('[data-form]').forEach(b => b.onclick = () => { const f = b.dataset.form; r.forms = r.forms.includes(f) ? r.forms.filter(x => x !== f) : r.forms.concat(f); dirty = true; drawEditor(); });
    if ($('#arPipe')) $('#arPipe').onchange = (e) => { r.pipeline = e.target.value; r.stage = ''; dirty = true; drawEditor(); };
    if ($('#arStage')) $('#arStage').onchange = (e) => { r.stage = e.target.value; dirty = true; };
    root.querySelectorAll('[data-var]').forEach(b => b.onclick = () => {
      const el = lastField.el && lastField.el.id === 'arSubj' ? $('#arSubj') : $('#arBody');
      const tok = '{{' + b.dataset.var + '}}';
      const s = el.selectionStart ?? el.value.length, e2 = el.selectionEnd ?? el.value.length;
      el.value = el.value.slice(0, s) + tok + el.value.slice(e2);
      el.focus(); el.setSelectionRange(s + tok.length, s + tok.length);
      el.dispatchEvent(new Event('input'));
    });
    $('#arCancel').onclick = () => { if (dirty && !confirm('Discard your changes?')) return; dirty = false; R.editing = null; drawReplies(); };
    $('#arTest').onclick = async () => { try { const t = await A.api.testReply(r); toast('Test sent to ' + t.to); } catch (e) { toast(e.message, true); } };
    $('#arSave').onclick = async () => {
      try { await A.api.saveReply(r); dirty = false; toast('Auto-reply saved'); renderReplies(); } catch (e) { toast(e.message, true); }
    };
    preview();
  }

  window.AdminPipelines = { render: renderPipelines };
  window.AdminReplies = { render: renderReplies };
})();
