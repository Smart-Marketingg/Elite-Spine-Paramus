(function () {
  'use strict';
  const A = window.Admin;
  const { $, esc, toast, ago, fmtDate } = A;
  const GBP_MSG = {
    connected: ['ok', 'Google Business Profile connected.'],
    pick: ['warn', 'Connected. Now pick which business location Claude should read.'],
    nolocations: ['warn', 'Google connected, but that account has no Business Profile locations. Reconnect with the Google account that manages Elite Spine.'],
    norefresh: ['warn', 'Google didn’t grant ongoing access. Click Connect again and approve every permission.'],
    cancelled: ['warn', 'Google connection was cancelled.'],
    expired: ['warn', 'That Google sign-in took too long. Try Connect again.'],
    failed: ['err', 'Google connection failed. Check the Google Cloud setup in ADMIN-SETUP.md and try again.']
  };
  let S = null;

  async function render() {
    const root = $('#view-ai');
    root.innerHTML = '<div class="empty">Loading…</div>';
    try { S = await A.api.ai(); } catch (e) { toast(e.message, true); return; }
    draw();
  }

  function statusCard(title, ok, lines, action) {
    return `<div class="card aistat${ok ? ' is-ok' : ''}">
      <div class="aistat__top"><span class="aistat__dot"></span><strong>${title}</strong></div>
      ${lines}
      ${action || ''}
    </div>`;
  }

  function draw() {
    const root = $('#view-ai');
    const s = S.settings, g = S.google, edit = S.canEdit;
    const msg = (location.hash.split('?gbp=')[1] || '');
    const m = GBP_MSG[decodeURIComponent(msg)];
    const last = S.lastRun;
    const googleCard = !g.configured && A.mode !== 'demo'
      ? statusCard('Google Business Profile', false, '<p>Not set up yet. A one-time Google Cloud setup is needed (see ADMIN-SETUP.md). Until then, paste posts below.</p>')
      : g.connected && g.needsLocation
        ? statusCard('Google Business Profile', false, `<p>Pick the location to read:</p><select class="select" id="gbpPick">${g.choices.map(c => `<option value="${esc(c.location)}">${esc(c.title)}${c.address ? ' · ' + esc(c.address) : ''}</option>`).join('')}</select>`,
          edit ? '<div class="aistat__acts"><button class="btn btn--sm btn--primary" id="gbpSave" type="button">Use this location</button></div>' : '')
        : g.connected
          ? statusCard('Google Business Profile', true, `<p><b>${esc(g.title || 'Connected')}</b>${g.address ? '<br>' + esc(g.address) : ''}</p>`, edit ? '<div class="aistat__acts"><button class="btn btn--sm" id="gbpOff" type="button">Disconnect</button></div>' : '')
          : statusCard('Google Business Profile', false, '<p>Connect the Google account that manages the Elite Spine profile so Claude can read new posts.</p>', edit ? '<div class="aistat__acts"><button class="btn btn--sm btn--primary" id="gbpOn" type="button">Connect Google</button></div>' : '');
    root.innerHTML = `
      <div class="phead">
        <div><h1>AI Writer</h1><p>Claude reads new Google Business Profile posts every week and writes a blog article for each one.</p></div>
        <div class="phead__actions">${edit ? `<button class="btn btn--primary" id="aiRun" type="button"${g.connected && !g.needsLocation ? '' : ' disabled title="Connect Google first"'}>Check Google now</button>` : ''}</div>
      </div>
      ${m ? `<div class="notice${m[0] === 'ok' ? ' notice--ok' : ''}"${m[0] === 'err' ? ' style="border-color:rgba(255,107,107,.4);background:rgba(255,107,107,.08)"' : ''}><strong>${esc(m[1])}</strong></div>` : ''}
      ${A.mode === 'demo' ? '<div class="notice"><strong>Demo mode.</strong> Google isn’t really connected and nothing is published. “Write with Claude” uses a live Claude preview when available.</div>' : ''}
      <div class="aistats">
        ${googleCard}
        ${statusCard('Claude', S.claudeReady, S.claudeReady ? '<p>Connected and ready to write.</p>' : '<p>Add your Anthropic API key (<code>ANTHROPIC_API_KEY</code>) to turn on writing.</p>')}
        ${statusCard('Weekly check', S.cronReady && s.enabled, `<p>${!s.enabled ? 'Paused.' : S.cronReady ? 'Runs every Monday morning.' : 'Scheduler not set up yet (see ADMIN-SETUP.md). Use “Check Google now” meanwhile.'}</p>
          <p class="cell-sub">${last ? `Last checked ${esc(ago(last.at))}: ${last.created || 0} new post${last.created === 1 ? '' : 's'}${last.error ? ' · <span style="color:var(--red)">' + esc(last.error) + '</span>' : ''}` : 'Not run yet.'}</p>`)}
      </div>
      <div class="aigrid">
        <div class="aicol">
          <section class="card aisec">
            <div class="aisec__head"><h2>Waiting for approval</h2><span class="pill pill--c" style="--c:#b48cff">${S.queue.length}</span></div>
            ${S.queue.length ? S.queue.map(p => `
              <article class="aiq" data-id="${p.id}">
                <span class="aiq__img"${p.hero ? ` style="background-image:url('${esc(p.hero)}')"` : ''}></span>
                <div class="aiq__main"><strong>${esc(p.title)}</strong><span>${esc(p.excerpt || '')}</span>
                  <em>${p.origin_ref && p.origin_ref.startsWith('manual') ? 'Written from pasted text' : 'From a Google post'} · ${esc(ago(p.updated_at))}</em></div>
                <div class="aiq__acts">
                  <a class="btn btn--sm" href="#blog/edit/${p.id}">Review &amp; edit</a>
                  ${edit ? `<button class="btn btn--sm btn--primary aiApprove" type="button">Approve &amp; publish</button><button class="btn btn--sm btn--danger aiReject" type="button">Reject</button>` : ''}
                </div>
              </article>`).join('') : `<div class="empty" style="padding:34px 16px"><strong>Nothing to review</strong>${s.autoPublish ? 'Auto-publish is on, so new posts go live without review.' : 'New drafts from Claude will show up here.'}</div>`}
          </section>
          <section class="card aisec">
            <div class="aisec__head"><h2>Write one now</h2></div>
            <p class="cell-sub" style="margin:0 0 12px">Paste a Google Business Profile post (or any note or topic) and Claude will write the article.</p>
            <div class="seg" id="wKind" style="max-width:360px"><button type="button" data-k="gbp" class="is-active">Google post</button><button type="button" data-k="note">Topic or note</button></div>
            <textarea class="textarea" id="wText" rows="5" placeholder="e.g. Now offering shockwave therapy for stubborn heel pain. Most patients feel relief in 3–5 sessions. Book a free consult this month."></textarea>
            <div class="aiw__foot"><span class="cell-sub" id="wNote">${s.autoPublish && edit ? 'Auto-publish is on: this goes live right away.' : 'Saved as a draft for review.'}</span><button class="btn btn--primary" id="wGo" type="button"${S.claudeReady || A.mode === 'demo' ? '' : ' disabled'}>Write with Claude</button></div>
          </section>
          <section class="card aisec">
            <div class="aisec__head"><h2>Recent Google posts</h2></div>
            ${S.recent.length ? `<ul class="airec">${S.recent.map(r => `<li>
              <div><span>${esc((r.summary || '').slice(0, 140))}${(r.summary || '').length > 140 ? '…' : ''}</span><em>${r.created ? 'Posted ' + esc(fmtDate(r.created, false)) : 'Seen ' + esc(ago(r.seen_at))}</em></div>
              <div>${r.status === 'done' && r.post_id ? `<a class="pill pill--c" style="--c:${r.post_status === 'published' ? '#4cc38a' : '#b48cff'}" href="#blog/edit/${r.post_id}">${r.post_status === 'published' ? 'Published' : 'Draft ready'}</a>`
                : r.status === 'failed' ? `<span class="pill pill--c" style="--c:#ff6b6b" title="${esc(r.error || '')}">Failed</span>` : r.status === 'rejected' ? '<span class="pill pill--c" style="--c:#95a0b3">Rejected</span>' : '<span class="pill pill--c" style="--c:#6aa7ff">Working…</span>'}</div>
            </li>`).join('')}</ul>` : '<p class="cell-sub" style="margin:0">No Google posts read yet.</p>'}
          </section>
        </div>
        <section class="card aisec aiset">
          <div class="aisec__head"><h2>Settings</h2></div>
          <div class="field"><label>When Claude writes a post</label>
            <div class="seg" id="sMode"><button type="button" data-v="0" class="${!s.autoPublish ? 'is-active' : ''}"${edit ? '' : ' disabled'}>Wait for my approval</button><button type="button" data-v="1" class="${s.autoPublish ? 'is-active' : ''}"${edit ? '' : ' disabled'}>Publish automatically</button></div>
            <span class="hint" id="sModeHint">${s.autoPublish ? 'Posts go live as soon as they’re written. You’ll get an email each time.' : 'Posts are saved as drafts. You’ll get an email to review and approve them.'}</span></div>
          <label class="ucheck" style="margin-bottom:14px"><input type="checkbox" id="sOn"${s.enabled ? ' checked' : ''}${edit ? '' : ' disabled'} /><span>Check Google every week</span></label>
          <div class="ared__row">
            <div class="field"><label for="sWords">Length</label><select class="select" id="sWords"${edit ? '' : ' disabled'}>${[[500, 'Short (~500 words)'], [700, 'Medium (~700 words)'], [1000, 'Long (~1,000 words)']].map(([v, l]) => `<option value="${v}"${+s.words === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="field"><label for="sMax">Max posts per week</label><select class="select" id="sMax"${edit ? '' : ' disabled'}>${[1, 2, 3, 4, 5].map(v => `<option${+s.maxPerRun === v ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label for="sCat">Default category</label><input class="input" id="sCat" value="${esc(s.category)}" maxlength="60"${edit ? '' : ' disabled'} /></div>
          <div class="field"><label for="sVoice">Writing voice <em>Tell Claude how to sound</em></label><textarea class="textarea" id="sVoice" rows="4" maxlength="600"${edit ? '' : ' disabled'}>${esc(s.voice)}</textarea></div>
          <div class="field"><label for="sNotify">Email me when posts are ready</label><input class="input" id="sNotify" type="email" value="${esc(s.notify)}" placeholder="Leave empty for no emails"${edit ? '' : ' disabled'} /></div>
          ${edit ? '<button class="btn btn--primary" id="sSave" type="button" style="width:100%">Save settings</button>' : '<p class="meta-note" style="margin:0">Only people with Blog → Publish access can change these.</p>'}
          <p class="meta-note" style="margin:14px 0 0">Claude is told not to invent patient stories, prices or medical claims, and to keep offer details exactly as written. Review AI posts before turning on auto-publish.</p>
        </section>
      </div>`;

    // ---- wiring ----
    let mode = s.autoPublish ? 1 : 0, kind = 'gbp';
    root.querySelectorAll('#sMode button').forEach(b => b.onclick = () => {
      mode = +b.dataset.v;
      root.querySelectorAll('#sMode button').forEach(x => x.classList.toggle('is-active', x === b));
      $('#sModeHint').textContent = mode ? 'Posts go live as soon as they’re written. You’ll get an email each time.' : 'Posts are saved as drafts. You’ll get an email to review and approve them.';
    });
    root.querySelectorAll('#wKind button').forEach(b => b.onclick = () => {
      kind = b.dataset.k;
      root.querySelectorAll('#wKind button').forEach(x => x.classList.toggle('is-active', x === b));
      $('#wText').placeholder = kind === 'gbp' ? 'Paste the Google Business Profile post here…' : 'e.g. 5 signs your lower back pain needs more than rest';
    });
    if ($('#sSave')) $('#sSave').onclick = async () => {
      if (mode && !s.autoPublish && !confirm('Turn on auto-publish? Claude’s posts will go live on your website without review.')) return;
      try {
        const r = await A.api.saveAi({ enabled: $('#sOn').checked, autoPublish: !!mode, words: $('#sWords').value, maxPerRun: $('#sMax').value, category: $('#sCat').value, voice: $('#sVoice').value, notify: $('#sNotify').value });
        S.settings = r.settings; toast('Settings saved'); draw();
      } catch (e) { toast(e.message, true); }
    };
    if ($('#aiRun')) $('#aiRun').onclick = async () => {
      const b = $('#aiRun'); b.disabled = true; b.textContent = 'Checking…';
      try {
        const r = await A.api.aiRun();
        toast(r.created.length ? `Claude wrote ${r.created.length} new post${r.created.length > 1 ? 's' : ''}` : r.error ? r.error : 'No new Google posts since last check', !!(r.error && !r.created.length));
        render();
      } catch (e) { toast(e.message, true); b.disabled = false; b.textContent = 'Check Google now'; }
    };
    $('#wGo').onclick = async () => {
      const text = $('#wText').value.trim();
      if (text.length < 20) return toast('Paste the post or describe the topic first.', true);
      const b = $('#wGo'); b.disabled = true; b.textContent = 'Claude is writing…';
      try {
        const r = await A.api.aiWrite({ text, kind });
        toast(r.published ? 'Published: ' + r.title : 'Draft ready: ' + r.title);
        location.hash = '#blog/edit/' + r.id;
      } catch (e) { toast(e.message, true); b.disabled = false; b.textContent = 'Write with Claude'; }
    };
    root.querySelectorAll('.aiq').forEach(card => {
      const id = +card.dataset.id;
      const ap = card.querySelector('.aiApprove'), rj = card.querySelector('.aiReject');
      if (ap) ap.onclick = async () => { try { await A.api.aiReview(id, 'approve'); toast('Published'); render(); } catch (e) { toast(e.message, true); } };
      if (rj) rj.onclick = async () => {
        if (!confirm('Reject and delete this draft? Claude won’t rewrite the same Google post.')) return;
        try { await A.api.aiReview(id, 'reject'); toast('Draft rejected'); render(); } catch (e) { toast(e.message, true); }
      };
    });
    if ($('#gbpOn')) $('#gbpOn').onclick = async () => {
      try { const r = await A.api.gbpConnect(); if (r.url) location.href = r.url; else { toast('Connected'); render(); } } catch (e) { toast(e.message, true); }
    };
    if ($('#gbpOff')) $('#gbpOff').onclick = async () => {
      if (!confirm('Disconnect Google? The weekly check will stop until you reconnect.')) return;
      try { await A.api.gbpLocation({ disconnect: true }); toast('Disconnected'); render(); } catch (e) { toast(e.message, true); }
    };
    if ($('#gbpSave')) $('#gbpSave').onclick = async () => {
      try { await A.api.gbpLocation({ location: $('#gbpPick').value }); toast('Location saved'); history.replaceState(null, '', location.pathname + location.search + '#ai'); render(); } catch (e) { toast(e.message, true); }
    };
  }

  window.AdminAI = { render };
})();
