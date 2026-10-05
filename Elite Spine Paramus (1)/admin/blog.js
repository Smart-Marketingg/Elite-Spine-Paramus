(function () {
  'use strict';
  const A = window.Admin;
  const { $, esc, toast, fmtDate, ICON } = A;
  const root = () => $('#view-blog');
  const DEFAULT_CATS = ['Physical Therapy', 'Chiropractic', 'Sports Recovery', 'Youth Athletes', 'Occupational Therapy', 'Advanced Therapies', 'Wellness', 'Patient Guide'];
  const I = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"></path><path d="m11 18-6-6 6-6"></path></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="m21 17-5-5-9 8"></path></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"></path><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"></path></svg>',
    ul: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"></path><circle cx="4.5" cy="6" r="1" fill="currentColor"></circle><circle cx="4.5" cy="12" r="1" fill="currentColor"></circle><circle cx="4.5" cy="18" r="1" fill="currentColor"></circle></svg>',
    ol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 6h10M10 12h10M10 18h10"></path><path d="M4 5h1v4M4 9h2M4 14h2l-2 3h2" stroke-width="1.5"></path></svg>',
    quote: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h4v4c0 3-2 5-4 6l-1-1.5c1.5-1 2-2 2-3.5H7V7Zm8 0h4v4c0 3-2 5-4 6l-1-1.5c1.5-1 2-2 2-3.5h-1V7Z"></path></svg>',
    clear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 4h12M12 4 8 20M4 20h8M15 14l6 6M21 14l-6 6"></path></svg>'
  };

  const now = () => Date.now();
  const stateOf = (p) => p.status !== 'published' ? 'draft' : (p.publish_at && new Date(p.publish_at).getTime() > now() ? 'scheduled' : 'published');
  const STATE_LABEL = { draft: 'Draft', scheduled: 'Scheduled', published: 'Published' };
  const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
  const pad = (n) => String(n).padStart(2, '0');
  const toLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fromLocal = (v) => v ? new Date(v).toISOString() : null;
  const textOf = (html) => { const d = document.createElement('div'); d.innerHTML = html || ''; return (d.textContent || '').trim(); };
  const readTime = (html) => Math.max(1, Math.round(textOf(html).split(/\s+/).filter(Boolean).length / 220)) + ' min read';

  // client-side paste sanitizer (server re-sanitizes on save)
  const OK = new Set(['P', 'H2', 'H3', 'STRONG', 'B', 'EM', 'I', 'U', 'A', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'BR', 'IMG']);
  function clean(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    (function walk(node) {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 8) return n.remove();
        if (n.nodeType !== 1) return;
        walk(n);
        let tag = n.tagName;
        if (tag === 'H1') tag = 'H2';
        if (tag === 'H4' || tag === 'H5' || tag === 'H6') tag = 'H3';
        if (['SCRIPT', 'STYLE', 'META', 'LINK', 'IFRAME', 'OBJECT', 'SVG'].includes(tag)) return n.remove();
        if (!OK.has(tag)) { n.replaceWith(...n.childNodes); return; }
        const el = document.createElement(tag);
        if (tag === 'A' && /^(https?:|mailto:|tel:|\/)/i.test(n.getAttribute('href') || '')) el.setAttribute('href', n.getAttribute('href'));
        if (tag === 'IMG') { const s = n.getAttribute('src') || ''; if (!/^(https?:|\/|data:image\/)/i.test(s)) return n.remove(); el.setAttribute('src', s); el.setAttribute('alt', n.getAttribute('alt') || ''); }
        el.append(...n.childNodes);
        n.replaceWith(el);
      });
    })(doc.body);
    return doc.body.innerHTML;
  }

  // ---------- list ----------
  let listFilter = '';
  let cachedPosts = [];
  async function renderList() {
    root().innerHTML = `
      <div class="phead">
        <div><h1>Blog Posts</h1><p>Write, schedule, and publish articles to the Wellness Advice blog.</p></div>
        <div class="phead__actions"><a class="btn btn--primary" href="#blog/new">${I.plus}New post</a></div>
      </div>
      <div class="tabs" id="postTabs"></div>
      <div class="card plist" id="postList"><div class="empty">Loading…</div></div>`;
    try { cachedPosts = (await A.api.posts()).posts; } catch (e) { toast(e.message, true); return; }
    const counts = { '': cachedPosts.length, published: 0, scheduled: 0, draft: 0 };
    cachedPosts.forEach(p => counts[stateOf(p)]++);
    $('#postTabs').innerHTML = [['', 'All'], ['published', 'Published'], ['scheduled', 'Scheduled'], ['draft', 'Drafts']]
      .map(([k, v]) => `<button class="tab${listFilter === k ? ' is-active' : ''}" data-f="${k}" type="button">${v}<span>${counts[k]}</span></button>`).join('');
    $('#postTabs').querySelectorAll('.tab').forEach(b => b.onclick = () => { listFilter = b.dataset.f; renderList(); });
    const rows = cachedPosts.filter(p => !listFilter || stateOf(p) === listFilter);
    if (!rows.length) {
      $('#postList').innerHTML = `<div class="empty"><strong>${cachedPosts.length ? 'Nothing here' : 'No posts yet'}</strong>${cachedPosts.length ? 'Try another tab.' : 'Create your first article to publish it on the blog.'}</div>`;
      return;
    }
    $('#postList').innerHTML = `<table class="table"><thead><tr><th>Post</th><th>Status</th><th>Category</th><th>Date</th></tr></thead><tbody>${rows.map(p => {
      const s = stateOf(p);
      const date = s === 'draft' ? 'Edited ' + fmtDate(p.updated_at, false) : (s === 'scheduled' ? 'Goes live ' : '') + fmtDate(p.publish_at);
      return `<tr data-id="${p.id}"><td><div class="ptitle"><span class="pthumb" style="background-image:url('${esc(p.hero || '')}')"></span><div><strong>${esc(p.title)}</strong><span>/blog-post.html?post=${esc(p.slug)}</span></div></div></td>
        <td><span class="pill pill--${s}">${STATE_LABEL[s]}</span>${p.review === 'pending' ? ' <span class="pill pill--c" style="--c:#b48cff">Needs review</span>' : p.origin === 'ai' ? ' <span class="pill pill--c" style="--c:#b48cff">AI</span>' : ''}</td><td class="cell-muted">${esc(p.category || '—')}</td><td class="cell-muted">${esc(date)}</td></tr>`;
    }).join('')}</tbody></table>`;
    $('#postList').querySelectorAll('tr[data-id]').forEach(r => r.onclick = () => { location.hash = '#blog/edit/' + r.dataset.id; });
  }

  // ---------- editor ----------
  let P = null;
  let dirty = false;
  let slugTouched = false;
  let locked = false;

  function setDirty(v) {
    dirty = v;
    const s = $('#edState');
    if (s) { s.textContent = v ? 'Unsaved changes' : (P.id ? 'All changes saved' : 'New post'); s.classList.toggle('is-dirty', v); }
  }
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  function primaryLabel() {
    if (locked) return 'Publisher only';
    if (P.status !== 'published') return 'Save draft';
    const t = P.publish_at ? new Date(P.publish_at).getTime() : 0;
    if (t > now()) return 'Schedule';
    return P._wasLive ? 'Update' : 'Publish now';
  }

  async function renderEditor(id) {
    root().innerHTML = '<div class="empty">Loading…</div>';
    if (!cachedPosts.length) { try { cachedPosts = (await A.api.posts()).posts; } catch (_) {} }
    if (id) {
      try { P = (await A.api.post(id)).post; } catch (e) { toast(e.message, true); location.hash = '#blog'; return; }
      P._wasLive = stateOf(P) === 'published';
      slugTouched = true;
    } else {
      P = { title: '', slug: '', excerpt: '', body_html: '', category: '', tags: '', hero: '', seo_title: '', seo_description: '', status: 'draft', publish_at: null };
      slugTouched = false;
    }
    P.tagList = String(P.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    const canPub = A.can('blog', 'publish');
    locked = P.status === 'published' && !canPub;
    const cats = [...new Set(DEFAULT_CATS.concat(cachedPosts.map(p => p.category).filter(Boolean)))];

    root().innerHTML = `
      <div class="ed-top">
        <a class="btn btn--sm" href="#blog" id="edBack">${I.back}All posts</a>
        <span class="ed-top__state" id="edState"></span>
        <div class="ed-top__actions">
          <button class="btn btn--sm" id="edPreview" type="button">${I.eye}Preview</button>
          <button class="btn btn--primary btn--sm" id="edSave" type="button"></button>
        </div>
      </div>
      <div class="ed">
        <div>
          <textarea class="ed-title" id="fTitle" rows="1" placeholder="Post title">${esc(P.title)}</textarea>
          <div class="ed-slug">elitespineparamus.com/blog-post.html?post=<input id="fSlug" value="${esc(P.slug)}" placeholder="url-slug" aria-label="URL slug" /></div>
          <div class="field"><label for="fExcerpt">Excerpt <em id="cExcerpt"></em></label>
            <textarea class="textarea" id="fExcerpt" rows="2" placeholder="One or two sentences shown on the blog card.">${esc(P.excerpt || '')}</textarea></div>
          <div class="rte">
            <div class="rte__bar" id="rteBar">
              <button type="button" data-cmd="p" title="Paragraph">P</button>
              <button type="button" data-cmd="h2" title="Heading">H2</button>
              <button type="button" data-cmd="h3" title="Subheading">H3</button>
              <span class="rte__sep"></span>
              <button type="button" data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button>
              <button type="button" data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button>
              <button type="button" data-cmd="link" title="Link">${I.link}</button>
              <span class="rte__sep"></span>
              <button type="button" data-cmd="ul" title="Bulleted list">${I.ul}</button>
              <button type="button" data-cmd="ol" title="Numbered list">${I.ol}</button>
              <button type="button" data-cmd="quote" title="Quote">${I.quote}</button>
              <button type="button" data-cmd="image" title="Insert image">${I.img}</button>
              <span class="rte__sep"></span>
              <button type="button" data-cmd="clear" title="Clear formatting">${I.clear}</button>
            </div>
            <div class="rte__area" id="fBody" contenteditable="true" data-ph="Start writing… Use H2 for section headings."></div>
            <div class="rte__foot"><span id="cWords">0 words</span><span>Ctrl/Cmd + S to save</span></div>
          </div>
          <input type="file" id="bodyImg" accept="image/*" hidden />
        </div>
        <div>
          <div class="sidecard">
            <h3>Publishing</h3>
            <div class="seg" id="fStatus"><button type="button" data-s="draft"${locked ? ' disabled' : ''}>Draft</button><button type="button" data-s="published"${canPub ? '' : ' disabled title="Publisher access required"'}>Publish</button></div>
            ${canPub ? '' : `<p class="sched-note" style="margin-bottom:12px">${locked ? 'This post is live. Only a publisher can edit it.' : 'You can write and save drafts. A publisher reviews and publishes them.'}</p>`}
            <div class="field" id="dateField"><label for="fDate">Publish date &amp; time</label>
              <input class="input" id="fDate" type="datetime-local" value="${esc(toLocal(P.publish_at))}" />
              <span class="hint">Leave empty to publish immediately. Pick a future time to schedule.</span></div>
            <p class="sched-note" id="schedNote"></p>
          </div>
          <div class="sidecard">
            <h3>Featured image</h3>
            <label class="drop" id="drop"><span class="drop__empty">${I.img}<br />Drop an image or click to upload<br /><small>JPG, PNG, WebP · max 5 MB</small></span><input type="file" id="heroFile" accept="image/*" /></label>
            <div class="drop__row"><input class="input" id="fHero" placeholder="…or paste an image URL" value="${esc(P.hero || '')}" /><button class="btn btn--sm" id="heroRemove" type="button">Remove</button></div>
          </div>
          <div class="sidecard">
            <h3>Organize</h3>
            <div class="field"><label for="fCat">Category</label><input class="input" id="fCat" list="catList" value="${esc(P.category || '')}" placeholder="e.g. Sports Recovery" />
              <datalist id="catList">${cats.map(c => `<option value="${esc(c)}"></option>`).join('')}</datalist></div>
            <div class="field"><label>Tags</label><div class="chips" id="tags"><input id="tagIn" placeholder="Add tag, press Enter" /></div></div>
          </div>
          <div class="sidecard">
            <h3>Search appearance (SEO)</h3>
            <div class="field"><label for="fSeoT">SEO title <em id="cSeoT"></em></label><input class="input" id="fSeoT" value="${esc(P.seo_title || '')}" placeholder="Defaults to post title" /></div>
            <div class="field"><label for="fSeoD">Meta description <em id="cSeoD"></em></label><textarea class="textarea" id="fSeoD" rows="3" placeholder="Defaults to excerpt">${esc(P.seo_description || '')}</textarea></div>
            <div class="serp"><div class="serp__url" id="serpUrl"></div><div class="serp__title" id="serpTitle"></div><div class="serp__desc" id="serpDesc"></div></div>
          </div>
          ${P.id && canPub ? '<button class="btn btn--danger btn--sm" id="edDelete" type="button" style="width:100%">Delete post</button>' : ''}
        </div>
      </div>`;

    const body = $('#fBody');
    body.innerHTML = P.body_html || '';
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (_) {}

    const title = $('#fTitle');
    const grow = () => { title.style.height = 'auto'; title.style.height = title.scrollHeight + 'px'; };
    grow();
    title.addEventListener('input', () => { P.title = title.value; grow(); if (!slugTouched) { P.slug = slugify(P.title); $('#fSlug').value = P.slug; } sync(); setDirty(true); });
    $('#fSlug').addEventListener('input', (e) => { slugTouched = true; P.slug = slugify(e.target.value); sync(); setDirty(true); });
    $('#fSlug').addEventListener('blur', (e) => { e.target.value = P.slug; });
    $('#fExcerpt').addEventListener('input', (e) => { P.excerpt = e.target.value; sync(); setDirty(true); });
    $('#fCat').addEventListener('input', (e) => { P.category = e.target.value; setDirty(true); });
    $('#fSeoT').addEventListener('input', (e) => { P.seo_title = e.target.value; sync(); setDirty(true); });
    $('#fSeoD').addEventListener('input', (e) => { P.seo_description = e.target.value; sync(); setDirty(true); });
    $('#fDate').addEventListener('input', (e) => { P.publish_at = fromLocal(e.target.value); sync(); setDirty(true); });
    $('#fStatus').querySelectorAll('button').forEach(b => b.onclick = () => { P.status = b.dataset.s; sync(); setDirty(true); });
    $('#fHero').addEventListener('change', (e) => { P.hero = e.target.value.trim(); sync(); setDirty(true); });
    $('#heroRemove').onclick = () => { P.hero = ''; $('#fHero').value = ''; sync(); setDirty(true); };
    $('#heroFile').addEventListener('change', (e) => e.target.files[0] && uploadHero(e.target.files[0]));
    const drop = $('#drop');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
    drop.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) uploadHero(f); });

    renderTags();
    $('#tagIn').addEventListener('keydown', (e) => {
      const v = e.target.value.trim().replace(/,$/, '');
      if ((e.key === 'Enter' || e.key === ',') && v) { e.preventDefault(); if (!P.tagList.includes(v)) P.tagList.push(v); e.target.value = ''; renderTags(); setDirty(true); }
      if (e.key === 'Backspace' && !e.target.value && P.tagList.length) { P.tagList.pop(); renderTags(); setDirty(true); }
    });

    wireRte(body);
    $('#edSave').onclick = save;
    $('#edPreview').onclick = preview;
    $('#edBack').onclick = (e) => { if (!guard()) e.preventDefault(); };
    if ($('#edDelete')) $('#edDelete').onclick = async () => {
      if (!confirm('Delete this post permanently? If it is published it will disappear from the blog.')) return;
      try { await A.api.deletePost(P.id); dirty = false; toast('Post deleted'); location.hash = '#blog'; } catch (e) { toast(e.message, true); }
    };
    sync();
    setDirty(false);
    if (locked) { $('#edSave').disabled = true; body.contentEditable = 'false'; ['#fTitle', '#fSlug', '#fExcerpt', '#fCat', '#fSeoT', '#fSeoD', '#fDate', '#fHero', '#tagIn', '#heroFile'].forEach(s => { $(s).disabled = true; }); }
  }

  function renderTags() {
    const box = $('#tags');
    box.querySelectorAll('.chip').forEach(c => c.remove());
    P.tagList.forEach((t, i) => {
      const c = document.createElement('span');
      c.className = 'chip';
      c.innerHTML = `${esc(t)}<button type="button" aria-label="Remove ${esc(t)}">×</button>`;
      c.querySelector('button').onclick = () => { P.tagList.splice(i, 1); renderTags(); setDirty(true); };
      box.insertBefore(c, $('#tagIn'));
    });
  }

  async function uploadHero(file) {
    try {
      toast('Uploading…');
      const { url } = await A.api.upload(file);
      P.hero = url;
      $('#fHero').value = url.startsWith('data:') ? '(uploaded image)' : url;
      sync(); setDirty(true); toast('Image added');
    } catch (e) { toast(e.message, true); }
  }

  function counter(el, len, ideal) { el.textContent = len + ' / ' + ideal; el.classList.toggle('is-over', len > ideal); }

  function sync() {
    $('#fStatus').querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.s === P.status));
    $('#dateField').hidden = P.status !== 'published';
    const t = P.publish_at ? new Date(P.publish_at) : null;
    $('#schedNote').innerHTML = P.status !== 'published' ? 'Drafts are only visible here.'
      : t && t.getTime() > now() ? `Scheduled — goes live <strong>${esc(fmtDate(P.publish_at))}</strong>.`
      : P._wasLive ? 'This post is live on the blog.' : 'Will go live as soon as you publish.';
    $('#edSave').textContent = primaryLabel();
    const d = $('#drop');
    d.style.backgroundImage = P.hero ? `url("${P.hero.replace(/"/g, '%22')}")` : '';
    d.classList.toggle('has-img', !!P.hero);
    counter($('#cExcerpt'), (P.excerpt || '').length, 160);
    counter($('#cSeoT'), (P.seo_title || P.title || '').length, 60);
    counter($('#cSeoD'), (P.seo_description || P.excerpt || '').length, 160);
    $('#serpUrl').textContent = 'elitespineparamus.com › blog-post › ' + (P.slug || 'your-post');
    $('#serpTitle').textContent = (P.seo_title || P.title || 'Post title') + ' — Elite Spine & Sports Care';
    $('#serpDesc').textContent = P.seo_description || P.excerpt || 'Add an excerpt or meta description to control how this post appears in Google.';
    const words = textOf($('#fBody').innerHTML).split(/\s+/).filter(Boolean).length;
    $('#cWords').textContent = words + ' words · ' + readTime($('#fBody').innerHTML);
  }

  function wireRte(body) {
    const bar = $('#rteBar');
    const exec = (c, v) => { body.focus(); document.execCommand(c, false, v); onBody(); };
    const onBody = () => { P.body_html = body.innerHTML; sync(); setDirty(true); refresh(); };
    const refresh = () => {
      const block = String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '');
      bar.querySelectorAll('button').forEach(b => {
        const c = b.dataset.cmd;
        let on = false;
        try {
          if (c === 'bold' || c === 'italic') on = document.queryCommandState(c);
          else if (c === 'ul') on = document.queryCommandState('insertUnorderedList');
          else if (c === 'ol') on = document.queryCommandState('insertOrderedList');
          else if (c === 'h2' || c === 'h3') on = block === c;
          else if (c === 'quote') on = block === 'blockquote';
        } catch (_) {}
        b.classList.toggle('is-on', !!on);
      });
    };
    bar.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    bar.querySelectorAll('button').forEach(b => b.onclick = () => {
      const c = b.dataset.cmd;
      if (c === 'p' || c === 'h2' || c === 'h3') exec('formatBlock', '<' + c + '>');
      else if (c === 'quote') exec('formatBlock', '<blockquote>');
      else if (c === 'bold' || c === 'italic') exec(c);
      else if (c === 'ul') exec('insertUnorderedList');
      else if (c === 'ol') exec('insertOrderedList');
      else if (c === 'clear') { exec('removeFormat'); exec('formatBlock', '<p>'); }
      else if (c === 'link') {
        const url = prompt('Link URL (https://…, /page, mailto:, tel:)');
        if (url === null) return;
        if (!url.trim()) exec('unlink');
        else if (/^(https?:|mailto:|tel:|\/)/i.test(url.trim())) exec('createLink', url.trim());
        else toast('Links must start with https://, /, mailto: or tel:', true);
      } else if (c === 'image') $('#bodyImg').click();
    });
    $('#bodyImg').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try { toast('Uploading…'); const { url } = await A.api.upload(f); exec('insertImage', url); toast('Image inserted'); } catch (err) { toast(err.message, true); }
    });
    body.addEventListener('input', onBody);
    body.addEventListener('keyup', refresh);
    body.addEventListener('mouseup', refresh);
    body.addEventListener('paste', (e) => {
      e.preventDefault();
      const html = e.clipboardData.getData('text/html');
      if (html) document.execCommand('insertHTML', false, clean(html));
      else document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
      onBody();
    });
  }

  async function save() {
    if (locked) return;
    P.title = $('#fTitle').value.trim();
    P.body_html = $('#fBody').innerHTML;
    if (!P.title) { toast('Add a title first', true); $('#fTitle').focus(); return; }
    if (!P.slug) P.slug = slugify(P.title);
    if (P.status === 'published' && !P.publish_at) P.publish_at = new Date().toISOString();
    const payload = { id: P.id, title: P.title, slug: P.slug, excerpt: P.excerpt, body_html: P.body_html, category: P.category, tags: P.tagList, hero: P.hero, seo_title: P.seo_title, seo_description: P.seo_description, status: P.status, publish_at: P.publish_at };
    const btn = $('#edSave');
    btn.disabled = true;
    try {
      const r = await A.api.savePost(payload);
      const wasNew = !P.id;
      P.id = r.id;
      P._wasLive = stateOf(P) === 'published';
      dirty = false;
      toast(P.status !== 'published' ? 'Draft saved' : stateOf(P) === 'scheduled' ? 'Post scheduled' : 'Published');
      cachedPosts = [];
      if (wasNew) { history.replaceState(null, '', '#blog/edit/' + r.id); renderEditor(r.id); }
      else { setDirty(false); sync(); }
    } catch (e) { toast(e.message, true); }
    btn.disabled = false;
  }

  function preview() {
    const html = $('#fBody').innerHTML;
    const when = P.status === 'published' && P.publish_at ? fmtDate(P.publish_at, false) : 'Draft';
    const m = $('#previewModal');
    m.innerHTML = `<div class="modal__box">
      <div class="modal__bar"><span>Preview — how this post will look on the blog</span><button class="icon-btn" id="pvClose" type="button" aria-label="Close preview">${ICON.close}</button></div>
      <div class="pv__hero" style="background-image:url('${esc(P.hero || '')}')"><div class="pv__head">
        <span class="pv__tag">${esc(P.category || 'Uncategorized')}</span>
        <h1>${esc($('#fTitle').value || 'Untitled post')}</h1>
        <div class="pv__meta">${esc(when)} · ${esc(readTime(html))}</div></div></div>
      <div class="pv__body">${clean(html) || '<p><em>No content yet.</em></p>'}</div></div>`;
    m.classList.add('is-open');
    const close = () => m.classList.remove('is-open');
    $('#pvClose').onclick = close;
    m.onclick = (e) => { if (e.target === m) close(); };
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && $('#edSave') && !root().hidden) { e.preventDefault(); save(); }
    if (e.key === 'Escape') $('#previewModal').classList.remove('is-open');
  });

  function guard() {
    if (!dirty) return true;
    if (confirm('You have unsaved changes. Leave without saving?')) { dirty = false; return true; }
    return false;
  }

  window.AdminBlog = {
    guard,
    route(rest) {
      if (rest[0] === 'new') renderEditor(null);
      else if (rest[0] === 'edit' && rest[1]) renderEditor(parseInt(rest[1], 10));
      else { dirty = false; renderList(); }
    }
  };
})();
