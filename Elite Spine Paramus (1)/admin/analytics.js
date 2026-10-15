(function () {
  'use strict';
  const A = window.Admin;
  const { $, esc, toast } = A;
  const KEY = 'esAdmin.analytics.v1';
  const DAY = 864e5;
  const iso = (d) => { const z = new Date(d); return z.getFullYear() + '-' + String(z.getMonth() + 1).padStart(2, '0') + '-' + String(z.getDate()).padStart(2, '0'); };
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const nf = (n) => Math.round(n || 0).toLocaleString('en-US');
  const pf = (n, dp = 1) => ((n || 0) * 100).toFixed(dp).replace(/\.0$/, '') + '%';
  const dur = (s) => { s = Math.round(s || 0); return Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's'; };
  const longDate = (s) => parse(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const shortDate = (s) => parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const rangeLabel = (r) => { const a = parse(r.start), b = parse(r.end);
    if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) return a.toLocaleDateString('en-US', { month: 'long' }) + ' ' + a.getDate() + ' – ' + b.getDate() + ', ' + b.getFullYear();
    return longDate(r.start) + ' – ' + longDate(r.end); };
  const change = (c, p) => (p == null ? null : p === 0 ? (c === 0 ? 0 : null) : (c - p) / p);
  const chg = (c, p, invert) => {
    const v = change(c, p);
    if (v == null) return '<span class="an-chg">—</span>';
    const good = invert ? v < 0 : v > 0;
    return `<span class="an-chg ${Math.abs(v) < 0.005 ? '' : good ? 'is-up' : 'is-down'}">${v > 0 ? '+' : ''}${Math.round(v * 100)}%</span>`;
  };
  const CH_COLORS = { 'Direct': '#95a0b3', 'Organic Search': '#4cc38a', 'Paid Search': '#6aa7ff', 'Referral': '#ff6a1a', 'Organic Social': '#f4c14a', 'Paid Social': '#b48cff', 'Email': '#f4c14a', 'Unassigned': '#6c7689', 'Organic Maps': '#4cc38a', 'Cross-network': '#b48cff', 'Display': '#b48cff', 'AI assistants': '#ff8a3d' };
  const chColor = (n) => CH_COLORS[n] || '#95a0b3';

  // ---------- date presets ----------
  const PRESETS = [['7d', 'Last 7 days'], ['28d', 'Last 28 days'], ['90d', 'Last 90 days'], ['month', 'This month'], ['lastmonth', 'Last month'], ['ytd', 'Year to date'], ['12m', 'Last 12 months'], ['custom', 'Custom range']];
  function presetRange(p) {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const y = new Date(t - DAY);
    if (p === '7d') return [iso(t - 7 * DAY), iso(y)];
    if (p === '28d') return [iso(t - 28 * DAY), iso(y)];
    if (p === '90d') return [iso(t - 90 * DAY), iso(y)];
    if (p === 'month') return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(t)];
    if (p === 'lastmonth') return [iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), iso(new Date(t.getFullYear(), t.getMonth(), 0))];
    if (p === 'ytd') return [iso(new Date(t.getFullYear(), 0, 1)), iso(t)];
    if (p === '12m') return [iso(new Date(t.getFullYear() - 1, t.getMonth(), t.getDate())), iso(y)];
    return null;
  }
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; } })();
  const S = { preset: saved.preset || 'lastmonth', start: saved.start, end: saved.end, compare: saved.compare || 'previous', channel: '', data: null, loading: false };
  if (S.preset !== 'custom' || !S.start) { const r = presetRange(S.preset === 'custom' ? 'lastmonth' : S.preset); S.start = r[0]; S.end = r[1]; if (S.preset === 'custom') S.preset = 'lastmonth'; }
  const persist = () => localStorage.setItem(KEY, JSON.stringify({ preset: S.preset, start: S.start, end: S.end, compare: S.compare }));

  // ---------- view ----------
  function render() {
    const root = $('#view-analytics');
    if (!$('#anBar')) shell(root);
    load();
  }
  function shell(root) {
    root.innerHTML = `
      <div class="phead">
        <div><h1>Analytics</h1><p>Website traffic from Google Analytics, alongside form leads from the CRM.</p></div>
        <div class="phead__actions">
          <button class="btn" id="anCsv" type="button">Export CSV</button>
          <button class="btn btn--primary" id="anPdf" type="button">Export PDF report</button>
        </div>
      </div>
      <div class="an-bar card" id="anBar">
        <div class="field"><label for="anPreset">Date range</label><select class="select" id="anPreset">${PRESETS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
        <div class="field"><label for="anStart">From</label><input class="input" type="date" id="anStart" /></div>
        <div class="field"><label for="anEnd">To</label><input class="input" type="date" id="anEnd" /></div>
        <div class="field"><label for="anCompare">Compare with</label><select class="select" id="anCompare"><option value="previous">Previous period</option><option value="year">Same period last year</option><option value="none">No comparison</option></select></div>
        <div class="field"><label for="anChannel">Traffic source</label><select class="select" id="anChannel"><option value="">All channels</option></select></div>
        <button class="btn" id="anRefresh" type="button" title="Fetch fresh numbers from Google">${A.ICON.refresh}</button>
      </div>
      <div id="anBody"><div class="empty">Loading…</div></div>`;
    $('#anPreset').value = S.preset; $('#anStart').value = S.start; $('#anEnd').value = S.end; $('#anCompare').value = S.compare;
    $('#anStart').max = $('#anEnd').max = iso(new Date());
    $('#anPreset').onchange = (e) => { S.preset = e.target.value; const r = presetRange(S.preset); if (r) { [S.start, S.end] = r; $('#anStart').value = S.start; $('#anEnd').value = S.end; } else $('#anStart').focus(); persist(); if (r) load(); };
    const dateChange = () => {
      const a = $('#anStart').value, b = $('#anEnd').value;
      if (!a || !b) return;
      if (a > b) return toast('“From” must be before “To”.', true);
      S.start = a; S.end = b; S.preset = 'custom'; $('#anPreset').value = 'custom'; persist(); load();
    };
    $('#anStart').onchange = dateChange; $('#anEnd').onchange = dateChange;
    $('#anCompare').onchange = (e) => { S.compare = e.target.value; persist(); load(); };
    $('#anChannel').onchange = (e) => { S.channel = e.target.value; load(); };
    $('#anRefresh').onclick = () => load(true);
    $('#anCsv').onclick = () => S.data && exportCsv(S.data);
    $('#anPdf').onclick = () => S.data && openReport(S.data);
  }

  async function load(fresh) {
    const body = $('#anBody');
    body.classList.add('is-loading');
    try {
      const d = await A.api.analytics({ start: S.start, end: S.end, compare: S.compare, channel: S.channel, fresh: fresh ? 1 : '' });
      S.data = d; draw(d);
      if (fresh) toast('Updated from Google Analytics');
    } catch (e) {
      body.innerHTML = `<div class="card empty"><strong>Couldn’t load analytics</strong>${esc(e.message)}</div>`;
    } finally { body.classList.remove('is-loading'); }
  }

  function tile(label, value, cur, prev, sub, invert) {
    return `<div class="card an-kpi"><span class="an-kpi__l">${label}</span><strong>${value}</strong><div class="an-kpi__f">${prev !== undefined ? chg(cur, prev, invert) : ''}${sub ? `<span>${sub}</span>` : ''}</div></div>`;
  }
  function table(cols, rowsHtml, empty) {
    return rowsHtml.length ? `<table class="table an-t"><thead><tr>${cols.map(c => `<th${c[1] ? ' class="num"' : ''}>${c[0]}</th>`).join('')}</tr></thead><tbody>${rowsHtml.join('')}</tbody></table>` : `<p class="cell-sub an-none">${empty || 'No data for this range.'}</p>`;
  }

  function drawChart() { const b = $('#anChartBox'); if (b && S.data && S.data.daily) b.innerHTML = chart(S.data); }
  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (!$('#view-analytics').hidden) drawChart(); }, 150); });

  function draw(d) {
    const sel = $('#anChannel');
    if (d.channels && !S.channel) sel.innerHTML = '<option value="">All channels</option>' + d.channels.map(c => `<option>${esc(c.name)}</option>`).join('');
    sel.value = S.channel;
    const body = $('#anBody');
    if (!d.configured) {
      body.innerHTML = `<div class="card an-setup"><h2>Connect Google Analytics</h2>
        <p>Analytics needs a one-time connection to your GA4 property. Missing: ${d.missing.map(m => `<code>${esc(m)}</code>`).join(', ')}.</p>
        <ol><li>Google Cloud → enable <b>Google Analytics Data API</b>.</li><li>Create a <b>service account</b> and download its JSON key.</li><li>GA4 → Admin → Property access management → add the service account email as <b>Viewer</b>.</li><li>Add <code>GA_SERVICE_ACCOUNT</code> (the whole JSON, as a Secret) and <code>GA4_PROPERTY_ID</code> to the site Worker, then redeploy.</li></ol>
        <p class="cell-sub">Full steps are in ADMIN-SETUP.md. CRM leads for this range: <b>${nf(d.leads.total)}</b>.</p></div>`;
      return;
    }
    if (d.error) { body.innerHTML = `<div class="card empty"><strong>Google Analytics returned an error</strong>${esc(d.error)}</div>`; return; }
    const k = d.kpis.cur, p = d.kpis.prev || {};
    const P = (m) => (d.kpis.prev ? p[m] : undefined);
    const leadsRate = k.sessions ? d.leads.total / k.sessions * 100 : 0;
    const total = d.channels.reduce((a, c) => a + c.sessions, 0) || 1;
    const insight = buildInsights(d);
    body.innerHTML = `
      <p class="an-range">${esc(rangeLabel(d.range))}${d.compare ? ` <span>vs ${esc(rangeLabel(d.compare))}</span>` : ''}${d.channel ? ` <span class="pill pill--c" style="--c:${chColor(d.channel)}">${esc(d.channel)} only</span>` : ''}</p>
      <div class="an-kpis">
        ${tile('Users', nf(k.totalUsers), k.totalUsers, P('totalUsers'), nf(k.newUsers) + ' new')}
        ${tile('Sessions', nf(k.sessions), k.sessions, P('sessions'), (k.totalUsers ? (k.sessions / k.totalUsers).toFixed(2) : '0') + ' per user')}
        ${tile('Engaged sessions', nf(k.engagedSessions), k.engagedSessions, P('engagedSessions'), pf(k.engagementRate) + ' engagement rate')}
        ${tile('Page views', nf(k.screenPageViews), k.screenPageViews, P('screenPageViews'), (k.sessions ? (k.screenPageViews / k.sessions).toFixed(2) : '0') + ' per session')}
        ${tile('Avg. session time', dur(k.averageSessionDuration), k.averageSessionDuration, P('averageSessionDuration'))}
        ${tile('Key events', nf(k.keyEvents), k.keyEvents, P('keyEvents'), 'Calls, bookings, forms')}
        ${tile('Form leads (CRM)', nf(d.leads.total), d.leads.total, d.compare ? d.leads.prev : undefined, leadsRate.toFixed(1) + ' per 100 sessions')}
        ${tile('Total events', nf(k.eventCount), k.eventCount, P('eventCount'))}
      </div>
      <section class="card an-card"><div class="an-card__h"><h2>Sessions over time</h2><div class="an-legend"><span><i style="--c:#ff6a1a"></i>Sessions</span><span><i style="--c:#6aa7ff"></i>Users</span>${d.dailyPrev.length ? '<span><i class="dash" style="--c:#95a0b3"></i>Sessions, comparison</span>' : ''}</div></div><div id="anChartBox"></div></section>
      <section class="card an-card an-insight"><div class="an-card__h"><h2>Snapshot</h2></div><p>${esc(insight.summary)}</p>
        ${insight.recs.length ? `<h3>What to do next</h3><ul>${insight.recs.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}</section>
      <div class="an-grid">
        <section class="card an-card"><div class="an-card__h"><h2>Where traffic came from</h2><span class="cell-sub">Default channel group</span></div>
          ${table([['Channel'], ['Sessions', 1], ['Share', 1], ['Key events', 1], d.compare ? ['Change', 1] : null].filter(Boolean),
            d.channels.map(c => `<tr><td><span class="src"><i class="dot" style="--c:${chColor(c.name)}"></i>${esc(c.name)}</span><div class="an-bar-s"><i style="width:${(c.sessions / total * 100).toFixed(1)}%;--c:${chColor(c.name)}"></i></div></td><td class="num">${nf(c.sessions)}</td><td class="num">${Math.round(c.sessions / total * 100)}%</td><td class="num">${nf(c.keyEvents)}</td>${d.compare ? `<td class="num">${chg(c.sessions, c.prevSessions)}</td>` : ''}</tr>`))}
        </section>
        <section class="card an-card"><div class="an-card__h"><h2>Top sources</h2><span class="cell-sub">Source / medium</span></div>
          ${table([['Source / medium'], ['Sessions', 1], ['Engaged', 1], ['Key events', 1]], d.sources.map(s => `<tr><td>${esc(s.name)}</td><td class="num">${nf(s.sessions)}</td><td class="num">${pf(s.engagementRate, 0)}</td><td class="num">${nf(s.keyEvents)}</td></tr>`))}
        </section>
        <section class="card an-card"><div class="an-card__h"><h2>Top pages</h2></div>
          ${table([['Page'], ['Views', 1], ['Users', 1], ['Avg. time', 1]], d.pages.map(pg => `<tr><td><div class="cell-name an-trunc" title="${esc(pg.path)}">${esc(pg.title || pg.path)}</div><div class="cell-sub an-trunc">${esc(pg.path)}</div></td><td class="num">${nf(pg.views)}</td><td class="num">${nf(pg.users)}</td><td class="num">${dur(pg.avgEngagement)}</td></tr>`))}
        </section>
        <section class="card an-card"><div class="an-card__h"><h2>Landing pages</h2><span class="cell-sub">First page of each visit</span></div>
          ${table([['Landing page'], ['Sessions', 1], ['Engaged', 1], ['Key events', 1]], d.landing.map(l => `<tr><td><div class="an-trunc" title="${esc(l.path)}">${esc(l.path)}</div></td><td class="num">${nf(l.sessions)}</td><td class="num${l.engagementRate < 0.4 ? ' an-low' : ''}">${pf(l.engagementRate, 0)}</td><td class="num">${nf(l.keyEvents)}</td></tr>`))}
        </section>
        <section class="card an-card"><div class="an-card__h"><h2>Events</h2><span class="cell-sub">★ = key event</span></div>
          ${table([['Event'], ['Count', 1], ['Users', 1]], d.events.map(ev => `<tr><td>${ev.key ? '<b class="an-star">★</b> ' : ''}${esc(ev.name)}</td><td class="num">${nf(ev.count)}</td><td class="num">${nf(ev.users)}</td></tr>`))}
        </section>
        <section class="card an-card"><div class="an-card__h"><h2>Devices &amp; locations</h2></div>
          <div class="an-dev">${d.devices.map(dv => { const t = d.devices.reduce((a, x) => a + x.sessions, 0) || 1; return `<div><span>${esc(dv.name[0].toUpperCase() + dv.name.slice(1))}</span><div class="an-bar-s"><i style="width:${(dv.sessions / t * 100).toFixed(1)}%;--c:#ff6a1a"></i></div><b>${Math.round(dv.sessions / t * 100)}%</b><em>${pf(dv.engagementRate, 0)} engaged</em></div>`; }).join('')}</div>
          ${table([['City'], ['Users', 1], ['Sessions', 1]], d.cities.slice(0, 8).map(c => `<tr><td>${esc(c.name)}</td><td class="num">${nf(c.users)}</td><td class="num">${nf(c.sessions)}</td></tr>`))}
        </section>
      </div>
      <p class="meta-note">Source: Google Analytics 4 (sessions by default channel group) and the Elite Spine CRM. Figures are cached for 15 minutes; use refresh for the latest. ${d.fetchedAt ? 'Loaded ' + esc(new Date(d.fetchedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })) + '.' : ''}</p>`;
    drawChart();
  }

  // ---------- SVG trend chart ----------
  function chart(d) {
    const box = document.querySelector('#anChartBox');
    const W = Math.max(320, Math.round((box && box.clientWidth) || 900)), H = 240, L = 40, R = 12, T = 12, B = 28;
    const cur = d.daily, prev = d.dailyPrev || [];
    if (!cur.length) return '<p class="cell-sub an-none">No visits in this range.</p>';
    const max = Math.max(1, ...cur.map(x => x.sessions), ...prev.slice(0, cur.length).map(x => x.sessions));
    const nice = Math.ceil(max / (max > 50 ? 10 : 5)) * (max > 50 ? 10 : 5);
    const x = (i) => L + (cur.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (cur.length - 1));
    const y = (v) => T + (H - T - B) * (1 - v / nice);
    const line = (arr, key) => arr.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[key]).toFixed(1)).join(' ');
    const area = line(cur, 'sessions') + ` L${x(cur.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(nice * f));
    const every = Math.max(1, Math.ceil(cur.length / Math.max(3, Math.floor((W - L - R) / 80))));
    return `<svg class="an-chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily sessions and users">
      ${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="g"></line><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
      ${cur.map((p, i) => i % every === 0 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${shortDate(p.date)}</text>` : '').join('')}
      <path d="${area}" fill="rgba(255,106,26,.12)"></path>
      ${prev.length ? `<path d="${line(prev.slice(0, cur.length), 'sessions')}" class="pv"></path>` : ''}
      <path d="${line(cur, 'users')}" class="us"></path>
      <path d="${line(cur, 'sessions')}" class="ss"></path>
      ${cur.map((p, i) => `<rect x="${x(i) - (W - L - R) / cur.length / 2}" y="${T}" width="${(W - L - R) / cur.length}" height="${H - T - B}" fill="transparent"><title>${shortDate(p.date)}: ${p.sessions} sessions, ${p.users} users${prev[i] ? ' · comparison ' + prev[i].sessions : ''}</title></rect>`).join('')}
    </svg>`;
  }

  // ---------- plain-language snapshot + recommendations ----------
  function buildInsights(d) {
    const k = d.kpis.cur, p = d.kpis.prev;
    const share = (n) => { const c = d.channels.find(x => x.name === n); const t = d.channels.reduce((a, x) => a + x.sessions, 0) || 1; return c ? { s: c.sessions, pct: c.sessions / t, prev: c.prevSessions } : { s: 0, pct: 0, prev: null }; };
    const parts = [];
    const ch = p ? change(k.sessions, p.sessions) : null;
    parts.push(`The website drew ${nf(k.sessions)} sessions from ${nf(k.totalUsers)} visitors${ch == null ? '' : Math.abs(ch) < 0.005 ? ', level with the comparison period' : `, ${ch > 0 ? 'up' : 'down'} ${Math.abs(Math.round(ch * 100))}% on the comparison period`}.`);
    const top = d.channels.slice(0, 3).map(c => `${c.name.toLowerCase()} ${nf(c.sessions)}`);
    if (top.length) parts.push(`The biggest sources were ${top.join(', ')}.`);
    const paid = share('Paid Search');
    if (paid.s && paid.prev != null) parts.push(`Paid search visits went from ${nf(paid.prev)} to ${nf(paid.s)}.`);
    parts.push(`Visitors viewed ${nf(k.screenPageViews)} pages, ${pf(k.engagementRate, 0)} of sessions were engaged, and the CRM received ${nf(d.leads.total)} form lead${d.leads.total === 1 ? '' : 's'}.`);

    const recs = [];
    if (!k.keyEvents) recs.push('No key events are recorded. In GA4, mark the form submission, phone-click and Zocdoc booking events as key events so calls and bookings show up here.');
    if (k.engagementRate && k.engagementRate < 0.5) recs.push(`Only ${pf(k.engagementRate, 0)} of sessions were engaged. Tighten the first screen of the main landing pages so visitors see the service, the location and a booking button straight away.`);
    const weak = d.landing.filter(l => l.sessions >= Math.max(15, k.sessions * 0.05) && l.engagementRate < 0.4).sort((a, b) => b.sessions - a.sessions)[0];
    if (weak) recs.push(`${weak.path} brought ${nf(weak.sessions)} visits but only ${pf(weak.engagementRate, 0)} engaged. Review its headline, load speed and call to action.`);
    const org = share('Organic Search');
    if (org.pct < 0.3) recs.push(`Organic search is ${Math.round(org.pct * 100)}% of traffic. Keep the weekly Google posts going (the AI Writer turns them into blog articles) and add condition pages for the main searches.`);
    if (p) {
      const drop = d.channels.filter(c => c.prevSessions >= 20 && change(c.sessions, c.prevSessions) <= -0.2).sort((a, b) => (a.sessions - a.prevSessions) - (b.sessions - b.prevSessions))[0];
      if (drop) recs.push(`${drop.name} fell from ${nf(drop.prevSessions)} to ${nf(drop.sessions)} sessions. Check whether a campaign, listing or link changed.`);
    }
    const mob = d.devices.find(x => x.name === 'mobile');
    const desk = d.devices.find(x => x.name === 'desktop');
    if (mob && desk && mob.engagementRate < desk.engagementRate - 0.1) recs.push(`Mobile engagement (${pf(mob.engagementRate, 0)}) trails desktop (${pf(desk.engagementRate, 0)}). Test the site on a phone, especially the booking and call buttons.`);
    if (k.sessions >= 100 && d.leads.total / k.sessions < 0.01) recs.push(`Under 1 form lead per 100 sessions. Make the appointment form easier to find on service pages and keep it short.`);
    if (paid.s && paid.prev != null && paid.s > paid.prev * 1.5) recs.push('Paid search traffic grew sharply. Hold the ad budget for another month to confirm the cost per lead before raising it.');
    return { summary: parts.join(' '), recs: recs.slice(0, 5) };
  }

  // ---------- CSV ----------
  function exportCsv(d) {
    if (!d.configured || d.error) return toast('Nothing to export yet.', true);
    const cell = (v) => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const out = [];
    const sec = (title, head, rows) => { out.push([title], head, ...rows, []); };
    const k = d.kpis.cur, p = d.kpis.prev || {};
    out.push(['Elite Spine website analytics'], ['Range', d.range.start, d.range.end], d.compare ? ['Compared with', d.compare.start, d.compare.end] : [], d.channel ? ['Channel filter', d.channel] : [], []);
    sec('Summary', ['Metric', 'Current', d.compare ? 'Comparison' : ''], [
      ['Users', k.totalUsers, p.totalUsers], ['New users', k.newUsers, p.newUsers], ['Sessions', k.sessions, p.sessions], ['Engaged sessions', k.engagedSessions, p.engagedSessions],
      ['Engagement rate', (k.engagementRate * 100).toFixed(1) + '%', p.engagementRate != null ? (p.engagementRate * 100).toFixed(1) + '%' : ''], ['Page views', k.screenPageViews, p.screenPageViews],
      ['Avg session duration (s)', Math.round(k.averageSessionDuration), p.averageSessionDuration != null ? Math.round(p.averageSessionDuration) : ''], ['Key events', k.keyEvents, p.keyEvents], ['Events', k.eventCount, p.eventCount], ['CRM form leads', d.leads.total, d.leads.prev]]);
    sec('Daily', ['Date', 'Sessions', 'Users'], d.daily.map(x => [x.date, x.sessions, x.users]));
    sec('Channels', ['Channel', 'Sessions', 'Users', 'Engaged sessions', 'Key events', 'Comparison sessions'], d.channels.map(c => [c.name, c.sessions, c.users, c.engaged, c.keyEvents, c.prevSessions]));
    sec('Source / medium', ['Source / medium', 'Sessions', 'Users', 'Engagement rate', 'Key events'], d.sources.map(s => [s.name, s.sessions, s.users, (s.engagementRate * 100).toFixed(1) + '%', s.keyEvents]));
    sec('Top pages', ['Path', 'Title', 'Views', 'Users', 'Avg engagement (s)'], d.pages.map(x => [x.path, x.title, x.views, x.users, Math.round(x.avgEngagement)]));
    sec('Landing pages', ['Path', 'Sessions', 'Engagement rate', 'Key events'], d.landing.map(x => [x.path, x.sessions, (x.engagementRate * 100).toFixed(1) + '%', x.keyEvents]));
    sec('Events', ['Event', 'Count', 'Users', 'Key event'], d.events.map(x => [x.name, x.count, x.users, x.key ? 'yes' : '']));
    sec('Devices', ['Device', 'Sessions', 'Engagement rate'], d.devices.map(x => [x.name, x.sessions, (x.engagementRate * 100).toFixed(1) + '%']));
    sec('Cities', ['City', 'Users', 'Sessions'], d.cities.map(x => [x.name, x.users, x.sessions]));
    sec('CRM leads by channel', ['Channel', 'Leads'], d.leads.byChannel.map(x => [x.name, x.n]));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + out.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' }));
    a.download = `elite-spine-analytics-${d.range.start}-to-${d.range.end}.csv`;
    a.click();
  }

  // ---------- printable PDF report (matches the monthly report layout) ----------
  function openReport(d) {
    if (!d.configured || d.error) return toast('Connect Google Analytics before exporting a report.', true);
    const w = window.open('', '_blank');
    if (!w) return toast('Allow pop-ups for this site to open the report.', true);
    const k = d.kpis.cur, p = d.kpis.prev;
    const ins = buildInsights(d);
    const cmpName = d.compare ? (d.compare.mode === 'year' ? 'same period last year' : 'previous period') : '';
    const c = (cur, prev, inv) => { const v = p ? change(cur, prev) : null; if (v == null) return '—'; const cls = Math.abs(v) < 0.005 ? '' : (inv ? v < 0 : v > 0) ? 'up' : 'down'; return `<span class="${cls}">${v > 0 ? '+' : ''}${Math.round(v * 100)}%</span>`; };
    const vs = (cur, prev, inv) => p ? `${c(cur, prev, inv)} vs ${d.compare.mode === 'year' ? 'last year' : 'prior'}` : '';
    const total = d.channels.reduce((a, x) => a + x.sessions, 0) || 1;
    const title = `Elite Spine — ${rangeLabel(d.range)} Website Report`;
    const row = (label, cur, prev, fmt, inv) => `<tr><td>${label}</td><td>${fmt(cur)}</td>${p ? `<td>${fmt(prev)}</td><td>${c(cur, prev, inv)}</td>` : ''}</tr>`;
    w.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
@page{size:letter;margin:.5in}
*{box-sizing:border-box}body{margin:0;background:#e9e6df;font-family:Manrope,Arial,sans-serif;color:#0a1628;font-size:12px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bar{position:sticky;top:0;z-index:2;display:flex;gap:10px;align-items:center;justify-content:center;padding:12px;background:#0a1628;color:#d8d4c8;font-size:13px}
.bar button{font:inherit;font-weight:700;border:0;border-radius:999px;padding:9px 18px;cursor:pointer;background:#ff6a1a;color:#fff}.bar button.ghost{background:transparent;border:1px solid rgba(255,255,255,.3);color:#fff}
.page{width:8.5in;min-height:11in;margin:20px auto;background:#fff;padding:.5in;box-shadow:0 10px 40px rgba(10,22,40,.15)}
.lbl{font-size:9px;letter-spacing:.24em;text-transform:uppercase;font-weight:700;color:#5c6577}
.eyebrow{color:#ff6a1a}
h1{font-family:'Playfair Display',Georgia,serif;font-weight:500;font-size:28px;line-height:1.15;margin:6px 0 4px}
.sub{color:#5c6577;margin:0 0 18px}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px}
.kpi{border:1px solid #e3e1db;border-radius:8px;padding:10px 12px;border-top:3px solid #ff6a1a}
.kpi b{display:block;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;margin:4px 0 2px}
.kpi em{display:block;font-style:normal;font-size:10.5px;color:#5c6577}
.up{color:#1f8a5b;font-weight:700}.down{color:#c2410c;font-weight:700}
h2{margin:18px 0 6px}
p.sum{margin:0;font-size:12px}
[contenteditable]{outline:none;border-radius:4px}[contenteditable]:hover{background:#fff7f1}[contenteditable]:focus{background:#fff7f1;box-shadow:0 0 0 2px #ffd1b3}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}
table{width:100%;border-collapse:collapse;font-size:11px}
th{text-align:left;font-size:8.5px;letter-spacing:.2em;text-transform:uppercase;color:#5c6577;font-weight:700;padding:6px 6px;border-bottom:1.5px solid #0a1628}
td{padding:5px 6px;border-bottom:1px solid #eceae4}
td:not(:first-child),th:not(:first-child){text-align:right}
.share{display:inline-block;width:46px;height:5px;background:#eceae4;border-radius:3px;vertical-align:middle;margin-left:6px;overflow:hidden}.share i{display:block;height:100%;background:#ff6a1a}
ul.recs{margin:4px 0 0;padding-left:16px}ul.recs li{margin-bottom:5px}
.foot{margin-top:18px;padding-top:10px;border-top:1px solid #e3e1db;font-size:9.5px;color:#5c6577}
.brand{display:flex;justify-content:space-between;gap:12px;margin-top:6px;font-weight:600;color:#0a1628}
@media print{body{background:#fff}.bar{display:none}.page{margin:0;width:auto;min-height:0;padding:0;box-shadow:none}[contenteditable]:hover{background:none}.cols{break-inside:avoid}table,tr{break-inside:avoid}}
</style></head><body>
<div class="bar"><span>Click any summary text or recommendation to edit it, then save as PDF.</span><button onclick="window.print()">Print / Save as PDF</button><button class="ghost" onclick="window.close()">Close</button></div>
<div class="page">
<div class="lbl eyebrow">Smart Marketing · Website Performance Report</div>
<h1 contenteditable="true">${esc(title)}</h1>
<p class="sub">${esc(rangeLabel(d.range))}${d.compare ? ' · compared with the ' + cmpName + ' (' + esc(rangeLabel(d.compare)) + ')' : ''}${d.channel ? ' · ' + esc(d.channel) + ' traffic only' : ''} · Prepared by Smart Marketing</p>
<div class="kpis">
<div class="kpi"><span class="lbl">Website sessions</span><b>${nf(k.sessions)}</b><em>${nf(k.totalUsers)} visitors</em><em>${vs(k.sessions, p && p.sessions)}</em></div>
<div class="kpi"><span class="lbl">Engaged sessions</span><b>${nf(k.engagedSessions)}</b><em>${pf(k.engagementRate, 0)} engagement</em><em>${vs(k.engagedSessions, p && p.engagedSessions)}</em></div>
<div class="kpi"><span class="lbl">Page views</span><b>${nf(k.screenPageViews)}</b><em>${k.sessions ? (k.screenPageViews / k.sessions).toFixed(1) : 0} per session</em><em>${vs(k.screenPageViews, p && p.screenPageViews)}</em></div>
<div class="kpi"><span class="lbl">Key events</span><b>${nf(k.keyEvents)}</b><em>Calls, bookings, forms</em><em>${vs(k.keyEvents, p && p.keyEvents)}</em></div>
<div class="kpi"><span class="lbl">Form leads</span><b>${nf(d.leads.total)}</b><em>From the website CRM</em><em>${p ? `${c(d.leads.total, d.leads.prev)} vs ${d.compare.mode === 'year' ? 'last year' : 'prior'}` : ''}</em></div>
</div>
<div class="lbl">Summary</div>
<p class="sum" contenteditable="true">${esc(ins.summary)}</p>
<div class="cols">
<div><h2 class="lbl">Website performance${p ? ' — period over period' : ''}</h2>
<table><thead><tr><th>Metric</th><th>${p ? 'Current' : 'Value'}</th>${p ? '<th>Comparison</th><th>Change</th>' : ''}</tr></thead><tbody>
${row('Unique visitors', k.totalUsers, p && p.totalUsers, nf)}${row('New visitors', k.newUsers, p && p.newUsers, nf)}${row('Sessions', k.sessions, p && p.sessions, nf)}${row('Engaged sessions', k.engagedSessions, p && p.engagedSessions, nf)}
${row('Engagement rate', k.engagementRate, p && p.engagementRate, (v) => pf(v))}${row('Page views', k.screenPageViews, p && p.screenPageViews, nf)}${row('Avg. session time', k.averageSessionDuration, p && p.averageSessionDuration, dur)}${row('Key events', k.keyEvents, p && p.keyEvents, nf)}${row('CRM form leads', d.leads.total, d.leads.prev, nf)}
</tbody></table></div>
<div><h2 class="lbl">Where the website traffic came from</h2>
<table><thead><tr><th>Channel</th><th>Sessions</th><th>Share</th>${p ? '<th>Change</th>' : ''}</tr></thead><tbody>
${d.channels.map(x => `<tr><td>${esc(x.name)}</td><td>${nf(x.sessions)}</td><td>${Math.round(x.sessions / total * 100)}%<span class="share"><i style="width:${(x.sessions / total * 100).toFixed(0)}%"></i></span></td>${p ? `<td>${c(x.sessions, x.prevSessions)}</td>` : ''}</tr>`).join('')}
</tbody></table></div>
</div>
<div class="cols">
<div><h2 class="lbl">Top pages</h2><table><thead><tr><th>Page</th><th>Views</th><th>Users</th></tr></thead><tbody>
${d.pages.slice(0, 8).map(x => `<tr><td>${esc(x.path)}</td><td>${nf(x.views)}</td><td>${nf(x.users)}</td></tr>`).join('')}</tbody></table></div>
<div><h2 class="lbl">Top events</h2><table><thead><tr><th>Event</th><th>Count</th><th>Users</th></tr></thead><tbody>
${d.events.slice(0, 8).map(x => `<tr><td>${x.key ? '★ ' : ''}${esc(x.name)}</td><td>${nf(x.count)}</td><td>${nf(x.users)}</td></tr>`).join('')}</tbody></table></div>
</div>
<h2 class="lbl">What we recommend next</h2>
<ul class="recs" contenteditable="true">${(ins.recs.length ? ins.recs : ['Traffic and engagement are steady. Keep weekly Google posts and blog articles going, and review again next month.']).map(r => `<li>${esc(r)}</li>`).join('')}</ul>
<div class="foot"><b>Method &amp; definitions:</b> ${esc(rangeLabel(d.range))}${d.compare ? ' vs ' + esc(rangeLabel(d.compare)) : ''}. Website figures from Google Analytics 4 (sessions by default channel group${d.channel ? '; filtered to ' + esc(d.channel) : ''}). “Engaged sessions” lasted 10+ seconds, viewed 2+ pages or included a key event. Key events are the actions marked as conversions in GA4. Form leads are website form submissions recorded in the Elite Spine CRM.
<div class="brand"><span>Smart Marketing · 923 Green Grove Road, Tinton Falls NJ 07712 · 732-900-3621</span><span>Generated ${esc(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}</span></div></div>
</div></body></html>`);
    w.document.close();
  }

  // ---------- demo data (preview only) ----------
  function demo(q) {
    const seed = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; };
    const s = parse(q.start), e = parse(q.end);
    const days = Math.round((e - s) / DAY) + 1;
    const len = days;
    let cs = null, ce = null;
    if (q.compare === 'previous') { ce = new Date(s - DAY); cs = new Date(s - len * DAY); }
    else if (q.compare === 'year') { cs = new Date(s); cs.setFullYear(cs.getFullYear() - 1); ce = new Date(e); ce.setFullYear(ce.getFullYear() - 1); }
    const SH = [['Direct', .42, .3], ['Organic Search', .30, .55], ['Paid Search', .215, .62], ['Referral', .023, .5], ['Unassigned', .02, .1], ['Organic Social', .018, .4], ['AI assistants', .005, .7], ['Cross-network', .004, .3]];
    const gen = (start, n, tag, scale) => {
      const r = seed(tag);
      const daily = [];
      for (let i = 0; i < n; i++) { const dt = new Date(start.getTime() + i * DAY); const wk = dt.getDay(); const base = 33.6 * scale * (wk === 0 ? .55 : wk === 6 ? .7 : 1.12); const sess = Math.max(0, Math.round(base * (0.75 + r() * 0.5))); daily.push({ date: iso(dt), sessions: sess, users: Math.round(sess * (0.8 + r() * 0.06)) }); }
      return daily;
    };
    const filt = q.channel ? (SH.find(x => x[0] === q.channel) || [0, 0.1])[1] : 1;
    const daily = gen(s, days, q.start + q.end, filt);
    const dailyPrev = cs ? gen(cs, days, 'p' + q.start, filt * (q.compare === 'year' ? 0.82 : 0.95)) : [];
    const sum = (a, k) => a.reduce((x, y) => x + y[k], 0);
    const mk = (dl, r) => { const ses = sum(dl, 'sessions'), us = Math.round(ses * 0.823); return { totalUsers: us, newUsers: Math.round(us * 0.86), sessions: ses, engagedSessions: Math.round(ses * (0.43 + r * 0.04)), engagementRate: 0.43 + r * 0.04, screenPageViews: Math.round(ses * 1.56), averageSessionDuration: 96 + r * 30, keyEvents: Math.round(ses * 0.047), eventCount: Math.round(ses * 7.4) }; };
    const cur = mk(daily, 0.5), prev = cs ? mk(dailyPrev, 0.2) : null;
    const chans = (q.channel ? SH.filter(x => x[0] === q.channel) : SH).map(([name, sh, er], i) => { const f = q.channel ? 1 : sh; const ses = Math.round(cur.sessions * f); return { name, sessions: ses, users: Math.round(ses * .82), engaged: Math.round(ses * er), keyEvents: Math.round(ses * (name === 'Paid Search' ? .14 : .02)), prevSessions: prev ? Math.round(prev.sessions * f * (name === 'Paid Search' ? .58 : 1.04)) : null }; });
    const pv = cur.screenPageViews;
    const PG = [['/', 'Physical Therapy & Chiropractic in Paramus, NJ | Elite Spine', .36, 52], ['/conditions-services', 'Conditions We Treat & Services | Elite Spine', .19, 74], ['/team', 'Our Team | Elite Spine Paramus', .09, 41], ['/insurance', 'Insurance | Elite Spine Paramus', .08, 38], ['/blog', 'Wellness Advice | Elite Spine', .06, 33], ['/blog/sciatica-relief-paramus', 'Sciatica Relief Without Surgery', .05, 96], ['/thank-you', 'Thank You | Elite Spine', .03, 12], ['/blog/heel-pain-shockwave-paramus', 'Stubborn Heel Pain? Shockwave Therapy', .03, 88]];
    const EV = [['page_view', pv, 0], ['user_engagement', Math.round(cur.sessions * 1.9), 0], ['session_start', cur.sessions, 0], ['first_visit', cur.newUsers, 0], ['scroll', Math.round(pv * .38), 0], ['click', Math.round(cur.sessions * .21), 0], ['phone_call_click', Math.round(cur.keyEvents * .55), 1], ['book_appointment_click', Math.round(cur.keyEvents * .3), 1], ['form_submit', Math.round(cur.keyEvents * .15), 1]];
    return {
      configured: true, fetchedAt: new Date().toISOString(), channel: q.channel || '',
      range: { start: q.start, end: q.end, days }, compare: cs ? { start: iso(cs), end: iso(ce), mode: q.compare } : null,
      kpis: { cur, prev }, daily, dailyPrev,
      channels: chans,
      sources: [['(direct) / (none)', .42], ['google / organic', .27], ['google / cpc', .215], ['bing / organic', .025], ['zocdoc.com / referral', .012], ['instagram / social', .012], ['chatgpt.com / referral', .005]].map(([name, f], i) => ({ name, sessions: Math.round(cur.sessions * f), users: Math.round(cur.sessions * f * .82), engagementRate: [.31, .56, .61, .52, .7, .4, .72][i], keyEvents: Math.round(cur.keyEvents * [.2, .2, .5, .02, .05, .01, .02][i]) })),
      pages: PG.map(([path, title, f, t]) => ({ path, title, views: Math.round(pv * f), users: Math.round(pv * f * .7), avgEngagement: t })),
      landing: PG.filter(x => x[0] !== '/thank-you').slice(0, 6).map(([path, , f], i) => ({ path, sessions: Math.round(cur.sessions * f * 1.1), engagementRate: [.38, .58, .45, .5, .41, .66][i], keyEvents: Math.round(cur.keyEvents * f) })),
      events: EV.map(([name, count, key]) => ({ name, count, users: Math.round(Math.min(count, cur.totalUsers) * .9), key: !!key })),
      devices: [{ name: 'mobile', sessions: Math.round(cur.sessions * .64), engagementRate: .39 }, { name: 'desktop', sessions: Math.round(cur.sessions * .33), engagementRate: .55 }, { name: 'tablet', sessions: Math.round(cur.sessions * .03), engagementRate: .44 }],
      cities: [['Paramus', .18], ['New York', .12], ['Hackensack', .07], ['Ridgewood', .06], ['Fair Lawn', .05], ['River Edge', .04], ['Oradell', .03], ['Rochelle Park', .02]].map(([name, f]) => ({ name, users: Math.round(cur.totalUsers * f), sessions: Math.round(cur.sessions * f) })),
      leads: { total: Math.round(cur.sessions * .021), prev: prev ? Math.round(prev.sessions * .018) : null, byChannel: [{ name: 'Google Ads', n: Math.round(cur.sessions * .011) }, { name: 'Organic Search', n: Math.round(cur.sessions * .005) }, { name: 'Direct', n: Math.round(cur.sessions * .005) }] }
    };
  }

  window.AdminAnalytics = { render, demo };
})();
