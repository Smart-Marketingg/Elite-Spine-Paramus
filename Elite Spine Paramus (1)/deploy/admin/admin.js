(function () {
  'use strict';

  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ICON = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"></path><path d="m7 10 5 5 5-5"></path><path d="M5 20h14"></path></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"></path></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"></path></svg>',
    sms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"></path></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 7 9 6 9-6"></path></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"></path><path d="M20 4v7h-7"></path></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path></svg>',
    board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4" width="5" height="16" rx="1.5"></rect><rect x="10" y="4" width="5" height="11" rx="1.5"></rect><rect x="17" y="4" width="4" height="7" rx="1.5"></rect></svg>'
  };

  function toast(msg, err) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('is-err', !!err);
    t.classList.add('is-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('is-show'), 2600);
  }
  function fmtDate(iso, withTime = true) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    return d.toLocaleString('en-US', withTime ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function ago(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    return fmtDate(iso, false);
  }
  const digits = (p) => String(p || '').replace(/[^\d+]/g, '');
  const pill = (label, color) => `<span class="pill pill--c" style="--c:${esc(color)}">${esc(label)}</span>`;
  const CHANNEL_COLOR = { 'Google Ads': '#6aa7ff', 'Microsoft Ads': '#6aa7ff', 'Meta Ads': '#b48cff', 'Other Paid': '#b48cff', 'Google Business Profile': '#4cc38a', 'Organic Search': '#4cc38a', 'Social': '#f4c14a', 'Email': '#f4c14a', 'Referral': '#ff6a1a', 'Direct': '#95a0b3' };
  const chan = (l) => l.channel || 'Direct';

  // Shared template rendering (mirrors functions/_lib/automation.js).
  const CLINIC = { phone: '(201) 483-6653', booking: 'https://www.zocdoc.com/practice/elite-spine-and-sports-care-60454' };
  function renderTemplate(tpl, lead) {
    const first = String(lead.name || '').trim().split(/\s+/)[0] || 'there';
    const v = { first_name: first, name: lead.name || 'there', service: lead.service || 'your visit', form: lead.form || 'our website', clinic_phone: CLINIC.phone, booking_link: CLINIC.booking };
    return String(tpl || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k) => (k.toLowerCase() in v ? v[k.toLowerCase()] : m));
  }

  // ---------- API: live (Cloudflare) or demo (localStorage) ----------
  const isProd = /(^|\.)elitespineparamus\.com$|\.pages\.dev$/.test(location.hostname);

  async function req(method, path, body) {
    const opt = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (body instanceof FormData) opt.body = body;
    else if (body) { opt.body = JSON.stringify(body); opt.headers['Content-Type'] = 'application/json'; }
    let r;
    try { r = await fetch(path, opt); } catch (_) { showGate(); throw new Error('Session expired'); }
    if (r.status === 401) { showGate(); throw new Error('Session expired'); }
    const d = await r.json().catch(() => ({}));
    if (r.status === 403 && d.error === 'no_access') { showGate('noaccess', d.email); throw new Error('No access'); }
    if (!r.ok) throw new Error(d.error || 'Request failed (' + r.status + ')');
    return d;
  }
  const qs = (p) => new URLSearchParams(Object.entries(p).filter(([, v]) => v !== '' && v != null)).toString();

  const live = {
    leads: (p) => req('GET', '/api/admin/leads?' + qs(p)),
    leadEmails: (id) => req('GET', '/api/admin/leads/' + id),
    setLeadStatus: (id, status) => req('PATCH', '/api/admin/leads/' + id, { status }),
    deleteLead: (id) => req('DELETE', '/api/admin/leads/' + id),
    exportLeads: (p) => { location.href = '/api/admin/leads/export?' + qs(p); },
    pipelines: () => req('GET', '/api/admin/pipelines'),
    savePipelines: (pipelines) => req('PUT', '/api/admin/pipelines', { pipelines }),
    replies: () => req('GET', '/api/admin/autoreplies'),
    saveReply: (r) => r.id ? req('PUT', '/api/admin/autoreplies/' + r.id, r) : req('POST', '/api/admin/autoreplies', r),
    deleteReply: (id) => req('DELETE', '/api/admin/autoreplies/' + id),
    testReply: (r) => req('POST', '/api/admin/autoreplies/test', r),
    posts: () => req('GET', '/api/admin/posts'),
    post: (id) => req('GET', '/api/admin/posts/' + id),
    savePost: (p) => p.id ? req('PUT', '/api/admin/posts/' + p.id, p) : req('POST', '/api/admin/posts', p),
    deletePost: (id) => req('DELETE', '/api/admin/posts/' + id),
    upload: (file) => { const f = new FormData(); f.append('file', file); return req('POST', '/api/admin/upload', f); },
    me: () => req('GET', '/api/admin/me'),
    users: () => req('GET', '/api/admin/users'),
    addUser: (u) => req('POST', '/api/admin/users', u),
    updateUser: (email, u) => req('PUT', '/api/admin/users/' + encodeURIComponent(email), u),
    removeUser: (email) => req('DELETE', '/api/admin/users/' + encodeURIComponent(email)),
    resendInvite: (email) => req('POST', '/api/admin/invite', { email }),
    changePassword: (b) => req('POST', '/api/admin/password', b),
    ai: () => req('GET', '/api/admin/ai'),
    saveAi: (s) => req('PUT', '/api/admin/ai', s),
    aiRun: () => req('POST', '/api/admin/ai/run'),
    aiWrite: (b) => req('POST', '/api/admin/ai/write', b),
    aiReview: (id, action) => req('POST', '/api/admin/ai/review', { id, action }),
    gbpConnect: () => req('POST', '/api/admin/gbp/connect'),
    keys: () => req('GET', '/api/admin/keys'),
    saveKey: (b) => req('PUT', '/api/admin/keys', b),
    gbpLocation: (b) => req('POST', '/api/admin/gbp/location', b),
    analytics: (p) => req('GET', '/api/admin/analytics?' + qs(p))
  };

  // Sign-in calls (no session needed). Errors come back as readable messages.
  async function authReq(method, path, body) {
    const r = await fetch(path, { method, credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Something went wrong. Try again.');
    return d;
  }
  const authLive = {
    login: (b) => authReq('POST', '/api/auth/login', b),
    forgot: (b) => authReq('POST', '/api/auth/forgot', b),
    token: (t) => authReq('GET', '/api/auth/token?t=' + encodeURIComponent(t)),
    accept: (b) => authReq('POST', '/api/auth/accept', b),
    logout: () => authReq('POST', '/api/auth/logout')
  };

  const DEMO_KEY = 'esAdmin.demo.v6';
  const SUPER = 'jullien@smartmarketingg.com';
  const DEFAULT_PIPES = [{ id: 'patients', name: 'Patient Leads', default: true, forms: [], stages: [
    { key: 'new', label: 'New', color: '#ff6a1a' }, { key: 'contacted', label: 'Contacted', color: '#6aa7ff' },
    { key: 'booked', label: 'Booked', color: '#4cc38a' }, { key: 'closed', label: 'Closed', color: '#95a0b3' }] }];
  const STARTER_BODY = 'Hi {{first_name}},\n\nThanks for contacting Elite Spine & Sports Care in Paramus. We received your request about {{service}} and a member of our team will reach out shortly, usually within one business day.\n\nWant to lock in a time now? Book online: {{booking_link}}\nOr call us at {{clinic_phone}}.\n\nTalk soon,\nElite Spine & Sports Care';
  function seed() {
    const h = (n) => new Date(Date.now() - n * 3600e3).toISOString();
    const L = (id, hrs, form, name, phone, email, service, message, status, a) => ({ id, created_at: h(hrs), form, source: 'index.html', name, phone, email, service, message, status, data: { name, phone, email, service, message }, ...a });
    return {
      nextLead: 8, nextPost: 4, nextReply: 3, as: SUPER, gbpUsed: 0,
      ai: { settings: { enabled: true, autoPublish: false, words: 700, category: 'Wellness', voice: 'Warm, confident and plain-spoken, like a trusted sports medicine clinician. Short paragraphs. No hype.', notify: 'elitespineparamus@gmail.com', maxPerRun: 3 }, connected: false, lastRun: null, recent: [] },
      pipelines: JSON.parse(JSON.stringify(DEFAULT_PIPES)),
      replies: [
        { id: 1, name: 'Thanks for reaching out', enabled: false, trigger: 'submit', forms: [], pipeline: null, stage: null, subject: 'We got your request, {{first_name}}', body: STARTER_BODY, reply_to: '', sent30: 0, lastSent: null },
        { id: 2, name: 'Booking confirmed', enabled: true, trigger: 'stage', forms: [], pipeline: 'patients', stage: 'booked', subject: 'You’re booked at Elite Spine, {{first_name}}', body: 'Hi {{first_name}},\n\nYou’re all set. We’re looking forward to seeing you at 37 W Century Rd, Paramus.\n\nPlease arrive 10 minutes early and bring your insurance card and photo ID. Need to reschedule? Call {{clinic_phone}}.\n\nElite Spine & Sports Care', reply_to: '', sent30: 2, lastSent: h(50) }
      ],
      emails: [
        { lead_id: 4, at: h(49), to_email: 'patient.d@example.com', subject: 'You’re booked at Elite Spine, Sample', status: 'sent', rule: 'Booking confirmed' },
        { lead_id: 3, at: h(97), to_email: 'patient.e@example.com', subject: 'You’re booked at Elite Spine, Sample', status: 'sent', rule: 'Booking confirmed' }
      ],
      users: [
        { email: 'elitespineparamus@gmail.com', name: 'Elite Spine Paramus (owner)', leads: 'manage', blog: 'publish', users: 0, setup: 1, source: 1, joined: 1, active: 1, created_at: h(400), created_by: 'setup', last_seen: h(3) },
        { email: 'frontdesk@example.com', name: 'Sample Front Desk', leads: 'manage', blog: 'none', users: 0, setup: 0, source: 0, off: ['analytics', 'ai'], joined: 1, active: 1, created_at: h(300), created_by: SUPER, last_seen: h(1) },
        { email: 'writer@example.com', name: 'Sample Writer', leads: 'none', blog: 'write', users: 0, setup: 0, source: 1, joined: 0, invite_expires: new Date(Date.now() + 5 * 864e5).toISOString(), active: 1, created_at: h(48), created_by: SUPER, last_seen: null }
      ],
      leads: [
        L(7, 0.4, 'Appointment Requests', 'Sample Patient A', '(201) 555-0142', 'patient.a@example.com', 'Lower Back Pain', 'Pain for about 3 weeks after lifting. Evenings work best.', 'new',
          { channel: 'Google Ads', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'back-pain-paramus', utm_term: 'back pain doctor paramus', click_id: 'gclid:Cj0KCQjw…', landing_page: '/conditions-services', first_touch: 'google / cpc / back-pain-paramus', first_seen: h(1) }),
        L(6, 5, 'Appointment Requests', 'Sample Patient B', '(201) 555-0187', 'patient.b@example.com', 'Sports Injury', 'Rolled my ankle playing soccer.', 'new',
          { channel: 'Google Business Profile', utm_source: 'google', utm_medium: 'gbp', utm_campaign: 'listing', landing_page: '/', first_touch: 'google / gbp / listing', first_seen: h(6) }),
        L(5, 26, 'Footer Consultation', 'Sample Patient C', '(551) 555-0110', 'patient.c@example.com', 'Chiropractic Care', '', 'contacted',
          { channel: 'Organic Search', referrer: 'https://www.google.com/', landing_page: '/blog/sciatica-relief', first_touch: 'google.com / referral', first_seen: h(80) }),
        L(4, 50, 'Appointment Requests', 'Sample Patient D', '(201) 555-0163', 'patient.d@example.com', 'Shockwave Therapy', 'Do you take Aetna?', 'booked',
          { channel: 'Meta Ads', utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'shockwave-fall', utm_content: 'video-a', click_id: 'fbclid:IwAR2…', landing_page: '/conditions-services', first_touch: 'facebook / paid_social / shockwave-fall', first_seen: h(52) }),
        L(3, 98, 'Appointment Requests', 'Sample Patient E', '(973) 555-0129', 'patient.e@example.com', 'Neck Pain', 'Desk job, stiff neck most mornings.', 'booked',
          { channel: 'Google Ads', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'back-pain-paramus', utm_term: 'neck pain treatment', click_id: 'gclid:EAIaIQ…', landing_page: '/', first_touch: 'google / cpc / back-pain-paramus', first_seen: h(99) }),
        L(2, 170, 'Footer Consultation', 'Sample Patient F', '(201) 555-0104', 'patient.f@example.com', 'Peptide Therapy', 'Interested in a consult.', 'closed',
          { channel: 'Social', utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'bio-link', landing_page: '/', first_touch: 'instagram / social / bio-link', first_seen: h(200) }),
        L(1, 260, 'Appointment Requests', 'Sample Patient G', '(201) 555-0198', 'patient.g@example.com', 'Physical Therapy', 'Post-op knee rehab.', 'closed',
          { channel: 'Direct', landing_page: '/', first_touch: '(direct)', first_seen: h(262) })
      ],
      posts: [
        { id: 2, slug: 'sample-scheduled-post', title: 'Sample: 5 Desk Stretches for Neck Pain', excerpt: 'A scheduled demo post.', body_html: '<p>Demo content.</p>', category: 'Wellness', tags: 'neck pain,posture', hero: '../images/cond-neck-opt.jpg', seo_title: '', seo_description: '', status: 'published', publish_at: new Date(Date.now() + 3 * 86400e3).toISOString(), updated_at: h(2) },
        { id: 3, slug: 'heel-pain-shockwave-paramus', title: 'Stubborn Heel Pain? How Shockwave Therapy Can Help', excerpt: 'Plantar fasciitis that won’t quit is one of the most common reasons runners and on-their-feet workers visit us. Here’s how shockwave fits in.', body_html: '<p>Demo AI draft written from a Google post.</p><h2>Why heel pain lingers</h2><p>Demo content.</p>', category: 'Treatments', tags: 'heel pain,shockwave', hero: '../images/clinic-opt.jpg', seo_title: '', seo_description: '', status: 'draft', publish_at: null, updated_at: h(20), origin: 'ai', origin_ref: 'gbp-demo-0', review: 'pending' },
        { id: 1, slug: 'sample-draft-post', title: 'Sample: What to Expect at Your First Visit', excerpt: 'A draft demo post.', body_html: '<h2>Before you arrive</h2><p>Demo content.</p>', category: 'Patient Guide', tags: 'first visit', hero: '../images/clinic-opt.jpg', seo_title: '', seo_description: '', status: 'draft', publish_at: null, updated_at: h(30) }
      ]
    };
  }
  const db = {
    get() { try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || this.reset(); } catch (_) { return this.reset(); } },
    set(d) { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); },
    reset() { const d = seed(); localStorage.setItem(DEMO_KEY, JSON.stringify(d)); return d; }
  };
  const pipeFor = (pipes, form) => pipes.find(p => !p.default && p.forms.includes(form)) || pipes.find(p => p.default) || pipes[0];
  function inPipe(pipes, pid, l) { const p = pipes.find(x => x.id === pid) || pipes.find(x => x.default); return pipeFor(pipes, l.form).id === p.id; }
  function filterLeads(d, p) {
    const q = (p.q || '').toLowerCase();
    return d.leads.filter(l => inPipe(d.pipelines, p.pipeline, l) && (!p.status || l.status === p.status) && (!p.form || l.form === p.form) &&
      (!p.channel || chan(l) === p.channel) && (!p.campaign || l.utm_campaign === p.campaign) &&
      (!q || [l.name, l.email, l.phone, l.service, l.message, l.utm_campaign, l.utm_source].some(v => String(v || '').toLowerCase().includes(q))));
  }
  const tally = (arr, key) => Object.entries(arr.reduce((m, x) => { const k = key(x); if (k) m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
  const wait = (v) => new Promise(r => setTimeout(() => r(v), 120));
  const demo = {
    leads(p) {
      const d = db.get();
      const pipe = d.pipelines.find(x => x.id === p.pipeline) || d.pipelines.find(x => x.default);
      const rows = filterLeads(d, { ...p, pipeline: pipe.id }).sort((a, b) => b.created_at.localeCompare(a.created_at));
      const base = d.leads.filter(l => inPipe(d.pipelines, pipe.id, l));
      const counts = Object.fromEntries(pipe.stages.map(s => [s.key, 0]));
      base.forEach(l => { if (l.status in counts) counts[l.status]++; });
      const fresh = d.leads.filter(l => pipeFor(d.pipelines, l.form).stages[0].key === l.status).length;
      const SRC = ['channel', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'click_id', 'referrer', 'landing_page', 'first_touch', 'first_seen'];
      const see = canDo('source');
      const strip = (l) => { if (see) return l; const o = { ...l }; SRC.forEach(c => delete o[c]); return o; };
      const shown = see ? rows : filterLeads(d, { ...p, pipeline: pipe.id, channel: '', campaign: '' }).sort((a, b) => b.created_at.localeCompare(a.created_at));
      return wait({ leads: shown.slice(p.offset || 0, (p.offset || 0) + (p.limit || 25)).map(strip), total: shown.length, counts, fresh,
        forms: [...new Set(base.map(l => l.form))].sort(), pipelines: d.pipelines, pipeline: pipe.id,
        channels: see ? tally(base, chan).map(([channel, n]) => ({ channel, n })) : [], campaigns: see ? tally(base, l => l.utm_campaign).map(([campaign, n]) => ({ campaign, n })) : [] });
    },
    leadEmails(id) { return wait({ emails: db.get().emails.filter(e => e.lead_id === id).sort((a, b) => b.at.localeCompare(a.at)) }); },
    setLeadStatus(id, status) {
      const d = db.get(); const l = d.leads.find(x => x.id === id);
      if (l) {
        const prev = l.status;
        l.status = status; l.updated_at = new Date().toISOString(); l.status_by = d.as;
        const p = pipeFor(d.pipelines, l.form);
        if (prev !== status) d.replies.filter(r => r.enabled && r.trigger === 'stage' && r.pipeline === p.id && r.stage === status).forEach(r => {
          if (d.emails.some(e => e.lead_id === id && e.rule === r.name && e.status === 'sent')) return;
          d.emails.push({ lead_id: id, at: new Date().toISOString(), to_email: l.email, subject: renderTemplate(r.subject, l), status: 'demo', rule: r.name, error: 'Demo mode, not actually sent' });
        });
      }
      db.set(d); return wait({ ok: true });
    },
    deleteLead(id) { const d = db.get(); d.leads = d.leads.filter(x => x.id !== id); db.set(d); return wait({ ok: true }); },
    exportLeads(p) {
      const cols = ['id', 'created_at', 'status', 'form', 'name', 'phone', 'email', 'service', 'message', 'channel', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'click_id', 'referrer', 'landing_page', 'first_touch'];
      const cell = (v) => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      const csv = [cols.join(',')].concat(filterLeads(db.get(), p).map(l => cols.map(c => cell(l[c])).join(','))).join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv' }));
      a.download = 'elite-spine-leads-demo.csv';
      a.click();
    },
    pipelines() { const d = db.get(); return wait({ pipelines: d.pipelines, forms: [...new Set(d.leads.map(l => l.form).concat(['Appointment Requests', 'Footer Consultation']))].sort() }); },
    savePipelines(pipes) {
      const d = db.get();
      if (!pipes.length) return Promise.reject(new Error('Add at least one pipeline.'));
      const owner = {};
      for (const p of pipes) {
        if (!String(p.name || '').trim()) return Promise.reject(new Error('Every pipeline needs a name.'));
        if (!p.stages.length) return Promise.reject(new Error(`Pipeline “${p.name}” needs at least one stage.`));
        if (p.stages.some(s => !String(s.label || '').trim())) return Promise.reject(new Error(`Pipeline “${p.name}”: every stage needs a name.`));
        if (!p.default) for (const f of p.forms) { if (owner[f]) return Promise.reject(new Error(`“${f}” is assigned to two pipelines.`)); owner[f] = p.name; }
      }
      d.pipelines = pipes;
      let moved = 0;
      d.leads.forEach(l => { const p = pipeFor(pipes, l.form); if (!p.stages.some(s => s.key === l.status)) { l.status = p.stages[0].key; moved++; } });
      db.set(d); return wait({ ok: true, pipelines: pipes, moved });
    },
    replies() { return wait({ rules: db.get().replies, mailReady: false, from: 'Elite Spine & Sports Care <hello@elitespineparamus.com>' }); },
    saveReply(r) {
      if (!String(r.name || '').trim()) return Promise.reject(new Error('Give the auto-reply a name.'));
      if (!String(r.subject || '').trim() || !String(r.body || '').trim()) return Promise.reject(new Error('Subject and message are required.'));
      if (r.trigger === 'stage' && (!r.pipeline || !r.stage)) return Promise.reject(new Error('Pick a pipeline and stage.'));
      const d = db.get();
      if (r.id) d.replies = d.replies.map(x => x.id === r.id ? { ...x, ...r } : x);
      else d.replies.push({ ...r, id: d.nextReply++, sent30: 0, lastSent: null });
      db.set(d); return wait({ ok: true });
    },
    deleteReply(id) { const d = db.get(); d.replies = d.replies.filter(x => x.id !== id); db.set(d); return wait({ ok: true }); },
    testReply() { return Promise.reject(new Error('Test emails only send on the live site once email sending is connected.')); },
    posts() { return wait({ posts: db.get().posts.slice().sort((a, b) => String(b.publish_at || b.updated_at).localeCompare(String(a.publish_at || a.updated_at))) }); },
    post(id) { const p = db.get().posts.find(x => x.id === id); return p ? wait({ post: p }) : Promise.reject(new Error('Not found')); },
    savePost(p) {
      const d = db.get();
      const slug = p.slug;
      if (d.posts.some(x => x.slug === slug && x.id !== p.id)) return Promise.reject(new Error('That URL slug is already used by another post.'));
      const row = { ...p, tags: Array.isArray(p.tags) ? p.tags.join(',') : p.tags, updated_at: new Date().toISOString() };
      if (row.status === 'published' && !row.publish_at) row.publish_at = new Date().toISOString();
      if (row.status === 'published' && row.review === 'pending') row.review = 'approved';
      if (p.id) d.posts = d.posts.map(x => x.id === p.id ? { ...x, ...row } : x);
      else { row.id = d.nextPost++; d.posts.push(row); }
      db.set(d);
      return wait({ ok: true, id: row.id, slug });
    },
    deletePost(id) { const d = db.get(); d.posts = d.posts.filter(x => x.id !== id); db.set(d); return wait({ ok: true }); },
    me() {
      const d = db.get();
      if (d.as === SUPER) return wait({ email: SUPER, name: 'Jullien', super: true, hasPassword: true, perms: { leads: 'manage', blog: 'publish', users: true, setup: true, source: true, off: [] } });
      const u = d.users.find(x => x.email === d.as) || d.users[0];
      return wait({ email: u.email, name: u.name, super: false, hasPassword: !!u.joined, perms: { leads: u.leads, blog: u.blog, users: !!u.users, setup: !!u.setup, source: u.source !== 0, off: u.off || [] } });
    },
    users() { return wait({ supers: [SUPER], users: db.get().users }); },
    addUser(u) {
      const d = db.get();
      const email = String(u.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Promise.reject(new Error('Enter a valid email address.'));
      if (email === SUPER || d.users.some(x => x.email === email)) return Promise.reject(new Error('That email already has access.'));
      d.users.push({ email, name: u.name || '', leads: u.leads, blog: u.blog, users: u.users ? 1 : 0, setup: u.setup ? 1 : 0, source: d.as === SUPER ? (u.source === false ? 0 : 1) : 1, off: d.as === SUPER ? (u.off || []) : [], joined: 0, invite_expires: new Date(Date.now() + 7 * 864e5).toISOString(), active: 1, created_at: new Date().toISOString(), created_by: d.as, last_seen: null });
      db.set(d); return wait({ ok: true, inviteUrl: location.origin + location.pathname + location.search + '#set=demo-invite~' + encodeURIComponent(email), emailed: false, emailError: 'Demo mode, no email is sent.' });
    },
    updateUser(email, u) {
      const d = db.get();
      if (email === d.as && !u.users) return Promise.reject(new Error('You can’t remove your own user-management access.'));
      d.users = d.users.map(x => x.email === email ? { ...x, name: u.name, leads: u.leads, blog: u.blog, users: u.users ? 1 : 0, setup: u.setup ? 1 : 0, source: d.as === SUPER ? (u.source === false ? 0 : 1) : x.source, off: d.as === SUPER ? (u.off || []) : (x.off || []), active: u.active === false ? 0 : 1 } : x);
      db.set(d); return wait({ ok: true });
    },
    resendInvite(email) {
      const d = db.get(); const u = d.users.find(x => x.email === email);
      if (!u) return Promise.reject(new Error('Not found'));
      if (u.joined) return Promise.reject(new Error('They already set a password. They can use “Forgot password” on the sign-in page.'));
      u.invite_expires = new Date(Date.now() + 7 * 864e5).toISOString(); db.set(d);
      return wait({ ok: true, inviteUrl: location.origin + location.pathname + location.search + '#set=demo-invite~' + encodeURIComponent(email), emailed: false, emailError: 'Demo mode, no email is sent.' });
    },
    changePassword(b) { if (String(b.next || '').length < 10) return Promise.reject(new Error('Use at least 10 characters.')); return wait({ ok: true }); },
    removeUser(email) {
      const d = db.get();
      if (email === d.as) return Promise.reject(new Error('You can’t remove yourself.'));
      d.users = d.users.filter(x => x.email !== email); db.set(d); return wait({ ok: true });
    },
    upload(file) {
      if (!/^image\//.test(file.type)) return Promise.reject(new Error('Images only.'));
      if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error('Max 5 MB per image.'));
      return new Promise((res) => { const r = new FileReader(); r.onload = () => res({ url: r.result }); r.readAsDataURL(file); });
    }
  };

  const GBP_SAMPLES = [
    'Now offering shockwave therapy for stubborn heel pain and plantar fasciitis. Most patients notice a difference within 3 to 5 sessions. Call or book online to see if it’s right for you.',
    'Weekend warriors: sore after Saturday’s game? Our sports rehab team in Paramus can get you moving again with hands-on treatment and a plan to prevent the next injury.',
    'Desk job, stiff neck? Try our three-minute posture reset: chin tucks, shoulder blade squeezes and a doorway stretch. Bring your questions to your next visit.'
  ];
  async function demoClaude(text, words) {
    const fallback = () => {
      const first = text.split(/[.!?]/)[0].trim().slice(0, 60);
      return { title: first.length > 20 ? first : 'What Paramus Patients Should Know', excerpt: text.slice(0, 180), category: 'Wellness', tags: ['paramus', 'recovery'], seo_title: first.slice(0, 58), seo_description: text.slice(0, 155),
        body_html: '<p>' + esc(text) + '</p><h2>What this means for you</h2><p>(Demo) In the live portal, Claude writes a full ~' + words + '-word article here, based on your Google post.</p><h2>Book an evaluation</h2><p>Call (201) 483-6653 or book online.</p>' };
    };
    if (!(window.claude && window.claude.complete)) return fallback();
    try {
      const out = await window.claude.complete('You write blog posts for Elite Spine & Sports Care, a physical therapy and chiropractic clinic in Paramus, NJ. Turn the source into an original article of about ' + Math.min(words, 450) + ' words. No cure claims, no invented patient stories or prices. End by inviting readers to book or call (201) 483-6653. Reply with ONLY a JSON object with keys: title, excerpt, category, tags (array), seo_title, seo_description, body_html (use only h2, h3, p, ul, li, strong).\n\nSource:\n' + text);
      const j = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
      return j.title && j.body_html ? j : fallback();
    } catch (_) { return fallback(); }
  }
  function demoSavePost(d, draft, ref) {
    const auto = d.ai.settings.autoPublish;
    const id = d.nextPost++;
    let slug = String(draft.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'post';
    while (d.posts.some(p => p.slug === slug)) slug += '-2';
    d.posts.push({ id, slug, title: draft.title, excerpt: draft.excerpt, body_html: draft.body_html, category: draft.category || d.ai.settings.category, tags: (draft.tags || []).join(','), hero: '', seo_title: draft.seo_title || '', seo_description: draft.seo_description || '',
      status: auto ? 'published' : 'draft', publish_at: auto ? new Date().toISOString() : null, updated_at: new Date().toISOString(), origin: 'ai', origin_ref: ref, review: auto ? 'auto' : 'pending' });
    return { id, slug, title: draft.title, published: auto };
  }
  Object.assign(demo, {
    analytics: (p) => wait(window.AdminAnalytics.demo(p)),
    keys() {
      const k = db.get().keys || {};
      const st = (n, demoSet) => ({ set: !!(k[n] || demoSet), from: k[n] ? 'app' : demoSet ? 'cloudflare' : null, hint: k[n] ? '…' + k[n].slice(-4) : demoSet ? '…demo' : '' });
      return wait({ keys: { ANTHROPIC_API_KEY: st('ANTHROPIC_API_KEY', false), GOOGLE_CLIENT_ID: st('GOOGLE_CLIENT_ID', false), GOOGLE_CLIENT_SECRET: st('GOOGLE_CLIENT_SECRET', false) }, redirectUri: location.origin + '/api/gbp/callback', origin: location.origin });
    },
    saveKey(b) {
      const d = db.get(); d.keys = d.keys || {};
      if (b.value) d.keys[b.name] = b.value; else delete d.keys[b.name];
      db.set(d); return this.keys().then(r => ({ ok: true, ...r }));
    },
    ai() {
      const d = db.get();
      return wait({ settings: d.ai.settings, canEdit: canDo('blog', 'publish'),
        google: { configured: true, connected: d.ai.connected, title: d.ai.connected ? 'Elite Spine & Sports Care' : null, address: d.ai.connected ? '37 W Century Rd, Paramus' : null, needsLocation: false, choices: [] },
        claudeReady: true, cronReady: true, canKeys: !!(me && me.super), lastRun: d.ai.lastRun,
        queue: d.posts.filter(p => p.origin === 'ai' && p.review === 'pending').sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
        recent: d.ai.recent.map(r => { const p = d.posts.find(x => x.id === r.post_id); return { ...r, post_title: p && p.title, post_status: p && p.status }; }) });
    },
    saveAi(s) { const d = db.get(); d.ai.settings = { ...d.ai.settings, ...s, words: +s.words, maxPerRun: +s.maxPerRun }; db.set(d); return wait({ ok: true, settings: d.ai.settings }); },
    gbpConnect() { const d = db.get(); d.ai.connected = true; d.ai.recent = [{ name: 'gbp-demo-0', summary: GBP_SAMPLES[0], created: new Date(Date.now() - 864e5).toISOString(), seen_at: new Date().toISOString(), status: 'done', post_id: 3 }]; d.gbpUsed = 1; db.set(d); return wait({}); },
    gbpLocation(b) { const d = db.get(); if (b.disconnect) d.ai.connected = false; db.set(d); return wait({ ok: true }); },
    async aiRun() {
      let d = db.get();
      if (!d.ai.connected) throw new Error('Connect Google first.');
      if (d.gbpUsed >= GBP_SAMPLES.length) { d.ai.lastRun = { at: new Date().toISOString(), created: 0 }; db.set(d); return { created: [] }; }
      const text = GBP_SAMPLES[d.gbpUsed];
      const draft = await demoClaude(text, d.ai.settings.words);
      d = db.get();
      const saved = demoSavePost(d, draft, 'gbp-demo-' + d.gbpUsed);
      d.ai.recent.unshift({ name: 'gbp-demo-' + d.gbpUsed, summary: text, created: new Date().toISOString(), seen_at: new Date().toISOString(), status: 'done', post_id: saved.id });
      d.gbpUsed++; d.ai.lastRun = { at: new Date().toISOString(), created: 1 }; db.set(d);
      return { created: [saved] };
    },
    async aiWrite(b) {
      if (String(b.text || '').trim().length < 20) throw new Error('Paste the post or describe the topic first.');
      const draft = await demoClaude(b.text, db.get().ai.settings.words);
      const d = db.get();
      if (!canDo('blog', 'publish')) d.ai.settings = { ...d.ai.settings, autoPublish: false };
      const saved = demoSavePost(d, draft, b.kind === 'gbp' ? 'manual-gbp' : 'manual');
      const real = db.get().ai.settings; d.ai.settings = real; db.set(d);
      return { ok: true, ...saved };
    },
    aiReview(id, action) {
      const d = db.get(); const p = d.posts.find(x => x.id === id);
      if (!p) return Promise.reject(new Error('Not found'));
      if (action === 'approve') { p.status = 'published'; p.publish_at = p.publish_at || new Date().toISOString(); p.review = 'approved'; }
      else { d.posts = d.posts.filter(x => x.id !== id); d.ai.recent.forEach(r => { if (r.post_id === id) { r.status = 'rejected'; r.post_id = null; } }); }
      db.set(d); return wait({ ok: true });
    }
  });

  const authDemo = {
    login({ email, password }) {
      const d = db.get(); email = String(email || '').trim().toLowerCase();
      const u = email === SUPER ? { email, joined: 1, active: 1 } : d.users.find(x => x.email === email);
      if (!u || !u.joined || !password) return Promise.reject(new Error('That email and password don’t match.'));
      if (!u.active) return Promise.reject(new Error('Your access is paused. Contact your administrator.'));
      d.as = email; db.set(d); sessionStorage.setItem('esDemoAuthed', '1'); return wait({ ok: true });
    },
    forgot({ email }) { return wait({ ok: true, demoLink: location.pathname + location.search + '#set=demo-reset~' + encodeURIComponent(String(email).trim().toLowerCase()) }); },
    token(t) {
      const m = /^demo-(invite|reset)~(.+)$/.exec(t || ''); if (!m) return wait({ valid: false });
      const email = decodeURIComponent(m[2]); const d = db.get();
      const u = email === SUPER ? { name: 'Jullien', joined: 1 } : d.users.find(x => x.email === email);
      if (!u || (m[1] === 'invite' && u.joined)) return wait({ valid: false });
      return wait({ valid: true, kind: m[1], email, name: u.name || '', joined: !!u.joined });
    },
    accept({ token, password, name }) {
      const m = /^demo-(invite|reset)~(.+)$/.exec(token || ''); if (!m) return Promise.reject(new Error('This link has expired or was already used.'));
      if (String(password).length < 10) return Promise.reject(new Error('Use at least 10 characters.'));
      const email = decodeURIComponent(m[2]); const d = db.get(); const u = d.users.find(x => x.email === email);
      if (u) { u.joined = 1; delete u.invite_expires; if (name) u.name = name; u.last_seen = new Date().toISOString(); }
      d.as = email; db.set(d); sessionStorage.setItem('esDemoAuthed', '1'); return wait({ ok: true });
    },
    logout() { sessionStorage.removeItem('esDemoAuthed'); return wait({ ok: true }); }
  };

  let api = live;
  let authApi = authLive;
  let mode = 'live';
  let me = null;
  const ORDER = { leads: ['none', 'view', 'manage'], blog: ['none', 'write', 'publish'] };
  function canDo(area, lvl) {
    if (!me) return false;
    const p = me.perms, on = (k) => me.super || !(p.off || []).includes(k);
    const at = (a, l) => ORDER[a].indexOf(p[a]) >= ORDER[a].indexOf(l);
    if (area === 'users') return !!p.users && on('users');
    if (area === 'pipelines' || area === 'replies') return !!p.setup && on(area);
    if (area === 'setup') return !!p.setup && (on('pipelines') || on('replies'));
    if (area === 'source') return !!p.source;
    if (area === 'ai') return on('ai') && at('blog', lvl || 'write');
    if (area === 'analytics') return on('analytics') && at('leads', 'view') && !!p.source;
    return on(area) && at(area, lvl);
  }
  const VIEWS = ['leads', 'analytics', 'blog', 'ai', 'pipelines', 'replies', 'users'];
  const allowed = (v) => v === 'leads' ? canDo('leads', 'view') : v === 'blog' ? canDo('blog', 'write') : VIEWS.includes(v) ? canDo(v) : false;
  const ROLE_TXT = { leads: { view: 'Leads (view)', manage: 'Leads' }, blog: { write: 'Blog (drafts)', publish: 'Blog' } };
  function roleText(p) {
    const parts = [ROLE_TXT.leads[p.leads] ? ROLE_TXT.leads[p.leads] + (p.source ? '' : ' (no source)') : '', ROLE_TXT.blog[p.blog], p.setup ? 'Setup' : '', p.users ? 'Users' : ''].filter(Boolean);
    if ((p.off || []).length) parts.push((p.off || []).length + ' hidden');
    return parts.length ? parts.join(' · ') : 'No access';
  }

  function showGate(kind, email) {
    if (kind === 'noaccess') return window.AdminAuth.show({ screen: 'noaccess', email });
    window.AdminAuth.show({ screen: 'login', notice: me ? 'Your session ended. Sign in again.' : '' });
  }

  // ---------- Leads view ----------
  const L = { pipeline: '', status: '', form: '', channel: '', campaign: '', q: '', offset: 0, limit: 25, data: null, openId: null, view: localStorage.getItem('esAdmin.leadView') || 'list' };
  const pipe = () => L.data && (L.data.pipelines.find(p => p.id === L.data.pipeline) || L.data.pipelines[0]);
  const stageOf = (key) => { const p = pipe(); return (p && p.stages.find(s => s.key === key)) || { key, label: key, color: '#95a0b3' }; };

  function leadsShell() {
    $('#view-leads').innerHTML = `
      <div class="phead">
        <div><h1>Leads</h1><p>${canDo('source') ? 'Every form submission from the website, with where each lead came from.' : 'Every form submission from the website, newest first.'}</p></div>
        <div class="phead__actions">
          <button class="btn" id="leadsRefresh" type="button">${ICON.refresh}Refresh</button>
          ${canDo('leads', 'manage') ? `<button class="btn btn--primary" id="leadsExport" type="button">${ICON.download}Export CSV</button>` : ''}
        </div>
      </div>
      <div class="lbar">
        <div class="lbar__pipe" id="pipeWrap" hidden><select class="select" id="leadPipe" aria-label="Pipeline"></select></div>
        <div class="seg seg--view" role="group" aria-label="Layout">
          <button type="button" data-v="list">${ICON.list}List</button><button type="button" data-v="board">${ICON.board}Board</button>
        </div>
      </div>
      <div class="tabs" id="leadTabs"></div>
      <div class="toolbar">
        <label class="search">${ICON.search}<input class="input" id="leadQ" type="search" placeholder="${canDo('source') ? 'Search name, phone, email, service, campaign…' : 'Search name, phone, email, service…'}" /></label>
        <select class="select" id="leadForm" aria-label="Form"><option value="">All forms</option></select>
        <select class="select" id="leadCamp" aria-label="Campaign" hidden><option value="">All campaigns</option></select>
      </div>
      <div class="srcbar" id="srcBar"></div>
      <div id="leadList"></div>`;
    let t;
    $('#leadQ').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { L.q = e.target.value; L.offset = 0; loadLeads(); }, 250); });
    $('#leadForm').addEventListener('change', (e) => { L.form = e.target.value; L.offset = 0; loadLeads(); });
    $('#leadCamp').addEventListener('change', (e) => { L.campaign = e.target.value; L.offset = 0; loadLeads(); });
    $('#leadPipe').addEventListener('change', (e) => { L.pipeline = e.target.value; L.status = ''; L.form = ''; L.channel = ''; L.campaign = ''; L.offset = 0; loadLeads(); });
    document.querySelectorAll('.seg--view button').forEach(b => b.addEventListener('click', () => {
      L.view = b.dataset.v; localStorage.setItem('esAdmin.leadView', L.view); L.offset = 0; loadLeads();
    }));
    if ($('#leadsExport')) $('#leadsExport').addEventListener('click', () => api.exportLeads(filters()));
    $('#leadsRefresh').addEventListener('click', () => loadLeads().then(() => toast('Up to date')));
  }
  const filters = () => ({ pipeline: L.pipeline, q: L.q, form: L.form, status: L.view === 'board' ? '' : L.status, channel: L.channel, campaign: L.campaign });

  async function loadLeads() {
    try {
      const board = L.view === 'board';
      L.data = await api.leads({ ...filters(), offset: board ? 0 : L.offset, limit: board ? 300 : L.limit });
      L.pipeline = L.data.pipeline;
      renderLeads();
    } catch (e) { toast(e.message, true); }
  }

  function renderLeads() {
    const d = L.data;
    const p = pipe();
    const all = Object.values(d.counts).reduce((a, b) => a + b, 0);
    document.querySelectorAll('.seg--view button').forEach(b => b.classList.toggle('is-active', b.dataset.v === L.view));
    $('#pipeWrap').hidden = d.pipelines.length < 2;
    $('#leadPipe').innerHTML = d.pipelines.map(x => `<option value="${esc(x.id)}"${x.id === p.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
    $('#leadTabs').hidden = L.view === 'board';
    $('#leadTabs').innerHTML = [['', 'All', all, '']].concat(p.stages.map(s => [s.key, s.label, d.counts[s.key] || 0, s.color]))
      .map(([k, v, n, c]) => `<button class="tab${L.status === k ? ' is-active' : ''}" data-s="${esc(k)}" type="button">${c ? `<i class="dot" style="--c:${esc(c)}"></i>` : ''}${esc(v)}<span>${n}</span></button>`).join('');
    $('#leadTabs').querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { L.status = b.dataset.s; L.offset = 0; loadLeads(); }));
    const nb = $('#navNew'); nb.hidden = !d.fresh; nb.textContent = d.fresh;

    $('#leadForm').innerHTML = '<option value="">All forms</option>' + d.forms.map(f => `<option${f === L.form ? ' selected' : ''}>${esc(f)}</option>`).join('');
    $('#leadCamp').hidden = !d.campaigns.length;
    $('#leadCamp').innerHTML = '<option value="">All campaigns</option>' + d.campaigns.map(c => `<option value="${esc(c.campaign)}"${c.campaign === L.campaign ? ' selected' : ''}>${esc(c.campaign)} (${c.n})</option>`).join('');
    const srcTotal = d.channels.reduce((a, c) => a + c.n, 0);
    $('#srcBar').innerHTML = !d.channels.length ? '' : `<span class="srcbar__label">Source</span>` +
      [{ channel: '', n: srcTotal }].concat(d.channels).map(c => `<button type="button" class="chip${L.channel === c.channel ? ' is-active' : ''}" data-c="${esc(c.channel)}">${c.channel ? `<i class="dot" style="--c:${CHANNEL_COLOR[c.channel] || '#95a0b3'}"></i>${esc(c.channel)}` : 'All sources'}<span>${c.n}</span></button>`).join('');
    $('#srcBar').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { L.channel = b.dataset.c; L.offset = 0; loadLeads(); }));

    if (L.view === 'board') return renderBoard();
    const list = $('#leadList');
    list.className = 'card';
    if (!d.leads.length) {
      list.innerHTML = `<div class="empty"><strong>${all ? 'No matching leads' : 'No leads yet'}</strong>${all ? 'Try a different search or filter.' : 'New form submissions will appear here automatically.'}</div>`;
      return;
    }
    const statusSel = (l) => !canDo('leads', 'manage') ? pill(stageOf(l.status).label, stageOf(l.status).color)
      : `<select class="status-select" data-id="${l.id}" aria-label="Stage" style="--c:${esc(stageOf(l.status).color)}">${p.stages.map(s => `<option value="${esc(s.key)}"${l.status === s.key ? ' selected' : ''}>${esc(s.label)}</option>`).join('')}</select>`;
    const first = p.stages[0].key;
    const see = canDo('source');
    const srcCell = (l) => !see ? `<span class="cell-muted">${esc(l.form || '—')}</span>` : `<div class="src"><i class="dot" style="--c:${CHANNEL_COLOR[chan(l)] || '#95a0b3'}"></i>${esc(chan(l))}</div><div class="cell-sub">${esc(l.utm_campaign || l.form || '')}</div>`;
    const rows = d.leads.map(l => `
      <tr data-id="${l.id}" class="${l.status === first ? 'is-new' : ''}">
        <td><div class="cell-name">${esc(l.name || 'No name')}</div><div class="cell-sub">${esc(l.service || '—')}</div></td>
        <td><div>${esc(l.phone || '—')}</div><div class="cell-sub">${esc(l.email || '')}</div></td>
        <td>${srcCell(l)}</td>
        <td class="cell-muted" title="${esc(fmtDate(l.created_at))}">${ago(l.created_at)}</td>
        <td>${statusSel(l)}</td>
      </tr>`).join('');
    const cards = d.leads.map(l => `
      <div class="mcard" data-id="${l.id}">
        <div class="mcard__top"><span class="cell-name">${esc(l.name || 'No name')}</span>${pill(stageOf(l.status).label, stageOf(l.status).color)}</div>
        <div class="cell-sub">${esc(l.service || '—')} · ${ago(l.created_at)}</div>
        ${see ? `<div class="cell-sub"><i class="dot" style="--c:${CHANNEL_COLOR[chan(l)] || '#95a0b3'}"></i> ${esc(chan(l))}${l.utm_campaign ? ' · ' + esc(l.utm_campaign) : ''}</div>` : ''}
      </div>`).join('');
    const from = L.offset + 1, to = L.offset + d.leads.length;
    list.innerHTML = `
      <table class="table table--leads"><thead><tr><th>Name / Interest</th><th>Contact</th><th>${see ? 'Source' : 'Form'}</th><th>Received</th><th>Stage</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="mcard-list">${cards}</div>
      <div class="pager"><span>${from}–${to} of ${d.total}</span><div>
        <button class="btn btn--sm" id="pgPrev" type="button"${L.offset ? '' : ' disabled'}>Previous</button>
        <button class="btn btn--sm" id="pgNext" type="button"${to < d.total ? '' : ' disabled'}>Next</button></div></div>`;
    $('#pgPrev').onclick = () => { L.offset = Math.max(0, L.offset - L.limit); loadLeads(); };
    $('#pgNext').onclick = () => { L.offset += L.limit; loadLeads(); };
    list.querySelectorAll('.status-select').forEach(s => {
      s.addEventListener('click', e => e.stopPropagation());
      s.addEventListener('change', () => setStatus(+s.dataset.id, s.value));
    });
    list.querySelectorAll('tr[data-id], .mcard').forEach(r => r.addEventListener('click', () => openLead(+r.dataset.id)));
  }

  function renderBoard() {
    const d = L.data, p = pipe(), list = $('#leadList');
    const canMove = canDo('leads', 'manage');
    list.className = 'board';
    list.innerHTML = p.stages.map(s => {
      const items = d.leads.filter(l => l.status === s.key);
      return `<section class="bcol" data-s="${esc(s.key)}" style="--c:${esc(s.color)}">
        <header class="bcol__head"><i class="dot" style="--c:${esc(s.color)}"></i><strong>${esc(s.label)}</strong><span>${d.counts[s.key] || 0}</span></header>
        <div class="bcol__body">${items.map(l => `
          <article class="bcard" data-id="${l.id}"${canMove ? ' draggable="true"' : ''}>
            <div class="cell-name">${esc(l.name || 'No name')}</div>
            <div class="cell-sub">${esc(l.service || '—')}</div>
            <div class="bcard__foot">${canDo('source') ? `<span class="src"><i class="dot" style="--c:${CHANNEL_COLOR[chan(l)] || '#95a0b3'}"></i>${esc(chan(l))}</span>` : `<span class="cell-sub">${esc(l.form || '')}</span>`}<span class="cell-sub">${ago(l.created_at)}</span></div>
          </article>`).join('') || '<p class="bcol__empty">No leads</p>'}</div>
      </section>`;
    }).join('') + (d.total > d.leads.length ? `<p class="board__more">Showing the newest ${d.leads.length} of ${d.total}. Use search or filters to narrow down.</p>` : '');
    list.querySelectorAll('.bcard').forEach(c => {
      c.addEventListener('click', () => openLead(+c.dataset.id));
      c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', c.dataset.id); e.dataTransfer.effectAllowed = 'move'; c.classList.add('is-drag'); });
      c.addEventListener('dragend', () => c.classList.remove('is-drag'));
    });
    if (canMove) list.querySelectorAll('.bcol').forEach(col => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('is-over'); });
      col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('is-over'); });
      col.addEventListener('drop', (e) => {
        e.preventDefault(); col.classList.remove('is-over');
        const id = +e.dataTransfer.getData('text/plain');
        const l = d.leads.find(x => x.id === id);
        if (l && l.status !== col.dataset.s) setStatus(id, col.dataset.s);
      });
    });
  }

  async function setStatus(id, status) {
    try {
      await api.setLeadStatus(id, status);
      toast('Moved to ' + stageOf(status).label);
      await loadLeads();
      if (L.openId === id) openLead(id);
    } catch (e) { toast(e.message, true); }
  }

  function openLead(id) {
    const l = L.data && L.data.leads.find(x => x.id === id);
    if (!l) return;
    L.openId = id;
    const p = pipe();
    const tel = digits(l.phone);
    const subj = encodeURIComponent('Your appointment request — Elite Spine & Sports Care');
    const first = String(l.name || '').split(' ')[0];
    const bodyTxt = encodeURIComponent(`Hi ${first},\n\nThanks for reaching out to Elite Spine & Sports Care in Paramus. `);
    const extra = Object.entries(l.data || {}).filter(([k]) => !['name', 'phone', 'email', 'service', 'message'].includes(k));
    const rows = [['Interest', l.service], ['Phone', l.phone], ['Email', l.email], ['Message', l.message]].concat(extra.map(([k, v]) => [k.replace(/[_-]/g, ' '), v]), [['Form', l.form]]);
    const srcSM = (l.utm_source || l.utm_medium) ? `${l.utm_source || '(none)'} / ${l.utm_medium || '(none)'}` : '';
    const src = [['Source / medium', srcSM], ['Campaign', l.utm_campaign], ['Keyword', l.utm_term], ['Ad / content', l.utm_content], ['Click ID', l.click_id], ['Referrer', l.referrer], ['Landing page', l.landing_page], ['Form page', l.source], ['First found site', l.first_touch ? l.first_touch + (l.first_seen ? ' · ' + fmtDate(l.first_seen, false) : '') : '']].filter(([, v]) => v);
    const canM = canDo('leads', 'manage');
    $('#drawer').innerHTML = `
      <div class="drawer__head">
        <div><h2>${esc(l.name || 'No name')}</h2><p>Received ${esc(fmtDate(l.created_at))}</p></div>
        <button class="icon-btn" id="drawerClose" type="button" aria-label="Close">${ICON.close}</button>
      </div>
      <div class="drawer__body">
        <div class="contact-actions">
          <a class="${tel ? '' : 'is-disabled'}" href="tel:${esc(tel)}">${ICON.phone}Call</a>
          <a class="${tel ? '' : 'is-disabled'}" href="sms:${esc(tel)}">${ICON.sms}Text</a>
          <a class="${l.email ? '' : 'is-disabled'}" href="mailto:${esc(l.email || '')}?subject=${subj}&body=${bodyTxt}">${ICON.mail}Email</a>
        </div>
        <p class="sec-label">Stage${L.data.pipelines.length > 1 ? ' · ' + esc(p.name) : ''}</p>
        <div class="status-row">${p.stages.map(s => `<button type="button" data-s="${esc(s.key)}" style="--c:${esc(s.color)}" class="${l.status === s.key ? 'is-active' : ''}"${canM ? '' : ' disabled'}>${esc(s.label)}</button>`).join('')}</div>
        ${canDo('source') ? `<p class="sec-label">Lead source</p>
        <div class="src-head"><span class="pill pill--c" style="--c:${CHANNEL_COLOR[chan(l)] || '#95a0b3'}">${esc(chan(l))}</span></div>
        ${src.length ? `<dl class="kv">${src.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '<p class="meta-note" style="margin-top:6px">No tracking details. This lead came in directly or before source tracking was added.</p>'}` : ''}
        <p class="sec-label">Submission</p>
        <dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v || '—')}</dd>`).join('')}</dl>
        <p class="sec-label">Auto-replies</p>
        <div class="elog" id="elog"><p class="meta-note" style="margin:0">Loading…</p></div>
        ${l.updated_at ? `<p class="meta-note">Stage last changed ${esc(fmtDate(l.updated_at))}${l.status_by ? ' by ' + esc(l.status_by) : ''}.</p>` : ''}
      </div>
      <div class="drawer__foot">
        ${canM ? '<button class="btn btn--danger btn--sm" id="leadDelete" type="button">Delete lead</button>' : '<span class="meta-note" style="margin:0">View-only access</span>'}
        <button class="btn btn--sm" id="drawerClose2" type="button">Close</button>
      </div>`;
    $('#drawer').querySelectorAll('.status-row button').forEach(b => b.addEventListener('click', () => setStatus(id, b.dataset.s)));
    $('#drawerClose').onclick = closeDrawer;
    $('#drawerClose2').onclick = closeDrawer;
    if ($('#leadDelete')) $('#leadDelete').onclick = async () => {
      if (!confirm('Permanently delete this lead? This cannot be undone. (It stays in the Google Sheet.)')) return;
      try { await api.deleteLead(id); closeDrawer(); toast('Lead deleted'); loadLeads(); } catch (e) { toast(e.message, true); }
    };
    api.leadEmails(id).then(r => {
      if (L.openId !== id || !$('#elog')) return;
      const LBL = { sent: 'Sent', failed: 'Failed', skipped: 'Not sent', demo: 'Demo' };
      const COL = { sent: '#4cc38a', failed: '#ff6b6b', skipped: '#95a0b3', demo: '#6aa7ff' };
      $('#elog').innerHTML = !r.emails.length ? '<p class="meta-note" style="margin:0">No automatic emails sent to this lead.</p>' : r.emails.map(e => `
        <div class="elog__row"><div><strong>${esc(e.rule || 'Auto-reply')}</strong><span>${esc(e.subject || '')}</span>${e.error ? `<em>${esc(e.error)}</em>` : ''}</div>
        <div class="elog__meta">${pill(LBL[e.status] || e.status, COL[e.status] || '#95a0b3')}<span>${esc(ago(e.at))}</span></div></div>`).join('');
    }).catch(() => { if ($('#elog')) $('#elog').innerHTML = '<p class="meta-note" style="margin:0">Couldn’t load email history.</p>'; });
    $('#drawer').classList.add('is-open');
    $('#drawer').setAttribute('aria-hidden', 'false');
    $('#scrim').classList.add('is-open');
  }
  function closeDrawer() {
    L.openId = null;
    $('#drawer').classList.remove('is-open');
    $('#drawer').setAttribute('aria-hidden', 'true');
    $('#scrim').classList.remove('is-open');
  }
  $('#scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  // ---------- routing ----------
  function route() {
    const views = VIEWS.filter(allowed);
    if (!views.length) return showGate('noaccess', me && me.email);
    const h = location.hash.replace(/^#\/?/, '').split('?')[0];
    const [view, ...rest] = h.split('/');
    const v = views.includes(view) ? view : views[0];
    document.querySelectorAll('.nav-item[data-view]').forEach(b => b.classList.toggle('is-active', b.dataset.view === v));
    VIEWS.forEach(x => { $('#view-' + x).hidden = x !== v; });
    closeDrawer();
    if (v === 'leads') { if (!$('#leadList')) leadsShell(); loadLeads(); }
    else if (v === 'blog') { if (window.AdminBlog) window.AdminBlog.route(rest); }
    else if (v === 'ai') { if (window.AdminAI) window.AdminAI.render(); }
    else if (v === 'analytics') { if (window.AdminAnalytics) window.AdminAnalytics.render(); }
    else if (v === 'pipelines') { if (window.AdminPipelines) window.AdminPipelines.render(); }
    else if (v === 'replies') { if (window.AdminReplies) window.AdminReplies.render(); }
    else if (window.AdminUsers) window.AdminUsers.render();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.nav-item[data-view]').forEach(b => b.addEventListener('click', () => {
    if (window.AdminBlog && window.AdminBlog.guard && !window.AdminBlog.guard()) return;
    if (window.AdminSettingsGuard && !window.AdminSettingsGuard()) return;
    location.hash = '#' + b.dataset.view;
  }));
  window.addEventListener('hashchange', () => {
    const tok = new URLSearchParams(location.hash.slice(1)).get('set');
    if (tok) return window.AdminAuth.show({ screen: 'set', token: tok });
    if (me) route();
  });

  // ---------- boot ----------
  async function applyMe(who) {
    me = who || await api.me();
    $('#userEmail').textContent = me.email;
    $('#userRole').textContent = me.super ? 'Super admin' : roleText(me.perms);
    document.querySelectorAll('.nav-item[data-view]').forEach(b => { b.hidden = !allowed(b.dataset.view); });
    $('#setupLabel').hidden = !canDo('setup');
    $('#pwLabel').textContent = me.hasPassword === false ? 'Set password' : 'Change password';
  }

  async function boot() {
    const tok = new URLSearchParams(location.hash.slice(1)).get('set');
    let who = null, status = 0, body = null, isJson = false;
    try {
      const r = await fetch('/api/admin/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      status = r.status; isJson = (r.headers.get('content-type') || '').includes('json');
      if (isJson) body = await r.json().catch(() => null);
      if (r.ok && isJson) who = body;
    } catch (_) { /* fall through */ }
    if (!who && (isProd || isJson)) {
      authApi = authLive;
      if (tok) return window.AdminAuth.show({ screen: 'set', token: tok });
      if (status === 403 && body && body.error === 'no_access') return showGate('noaccess', body.email);
      return window.AdminAuth.show({ screen: 'login' });
    }
    if (!who) {
      api = demo; mode = 'demo'; authApi = authDemo;
      if (tok) return window.AdminAuth.show({ screen: 'set', token: tok });
      if (!sessionStorage.getItem('esDemoAuthed')) return window.AdminAuth.show({ screen: 'login' });
      $('#demoBar').hidden = false;
      const sel = $('#demoAs');
      const fill = () => {
        const d = db.get();
        sel.innerHTML = [[SUPER, 'Jullien (super admin)']].concat(d.users.map(u => [u.email, u.name || u.email]))
          .map(([e, n]) => `<option value="${esc(e)}"${d.as === e ? ' selected' : ''}>${esc(n)}</option>`).join('');
      };
      const switchTo = async () => { await applyMe(); $('#view-leads').innerHTML = ''; L.pipeline = ''; fill(); route(); };
      fill();
      sel.onchange = () => { const d = db.get(); d.as = sel.value; db.set(d); history.replaceState(null, '', location.pathname); switchTo(); };
      $('#demoReset').onclick = () => { db.reset(); toast('Sample data reset'); switchTo(); };
      window.__demoRefreshUsers = fill;
    }
    await applyMe(who);
    $('#pwBtn').onclick = () => window.AdminAuth.changePassword(me.hasPassword !== false, me.email);
    $('#logoutBtn').onclick = async () => { try { await authApi.logout(); } catch (_) {} location.replace(location.pathname + location.search); };
    $('#gate').hidden = true;
    $('#app').hidden = false;
    route();
    setInterval(() => { if (!$('#view-leads').hidden && document.visibilityState === 'visible' && !L.openId) loadLeads(); }, 60000);
  }

  window.Admin = { $, esc, toast, fmtDate, ago, ICON, pill, renderTemplate, can: canDo, get me() { return me; }, get api() { return api; }, get auth() { return authApi; }, get mode() { return mode; } };
  boot();
})();
