// Google Analytics 4 (Data API) via a read-only service account.
// Needs: GA_SERVICE_ACCOUNT (secret: full JSON key) and GA4_PROPERTY_ID (numeric property id).
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uStr = (s) => b64u(enc.encode(s));
let cached = null; // { token, exp }

async function gaToken(env) {
  if (cached && cached.exp > Date.now() + 60e3) return cached.token;
  let sa;
  try { sa = JSON.parse(env.GA_SERVICE_ACCOUNT); } catch (_) { throw new Error('GA_SERVICE_ACCOUNT isn’t valid JSON. Paste the whole key file.'); }
  const pem = String(sa.private_key || '').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64uStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64uStr(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
  }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsigned));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + b64u(sig) })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Google Analytics sign-in failed: ' + (d.error_description || d.error || r.status));
  cached = { token: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 };
  return cached.token;
}

async function batch(env, token, requests) {
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:batchRunReports`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (d.error && d.error.message) || 'HTTP ' + r.status;
    if (r.status === 403) throw new Error('Google Analytics denied access. Add the service account email as a Viewer on the GA4 property. (' + msg + ')');
    throw new Error('Google Analytics error: ' + msg);
  }
  return d.reports || [];
}

const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
function rows(rep) {
  const dims = (rep.dimensionHeaders || []).map(h => h.name);
  const mets = (rep.metricHeaders || []).map(h => h.name);
  return (rep.rows || []).map(r => {
    const o = {};
    dims.forEach((n, i) => { o[n] = r.dimensionValues[i].value; });
    mets.forEach((n, i) => { o[n] = num(r.metricValues[i].value); });
    return o;
  });
}

const KPI_METRICS = ['totalUsers', 'newUsers', 'sessions', 'engagedSessions', 'engagementRate', 'screenPageViews', 'averageSessionDuration', 'keyEvents', 'eventCount'];
function kpiObj(r) {
  const o = {};
  KPI_METRICS.forEach(m => { o[m] = r ? r[m] || 0 : 0; });
  return o;
}

export async function gaReport(env, { start, end, cStart, cEnd, channel }) {
  const token = await gaToken(env);
  const ranges = cStart ? [{ startDate: start, endDate: end, name: 'cur' }, { startDate: cStart, endDate: cEnd, name: 'prev' }] : [{ startDate: start, endDate: end, name: 'cur' }];
  const cur = [{ startDate: start, endDate: end }];
  const dimensionFilter = channel ? { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { value: channel, matchType: 'EXACT' } } } : undefined;
  const R = (o) => ({ ...o, dimensionFilter, keepEmptyRows: false });
  const m = (...n) => n.map(name => ({ name }));
  const d = (...n) => n.map(name => ({ name }));
  const desc = (metric) => [{ metric: { metricName: metric }, desc: true }];

  const [b1, b2] = await Promise.all([
    batch(env, token, [
      R({ dateRanges: ranges, metrics: m(...KPI_METRICS) }),
      R({ dateRanges: ranges, dimensions: d('date'), metrics: m('sessions', 'totalUsers'), orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 800 }),
      R({ dateRanges: ranges, dimensions: d('sessionDefaultChannelGroup'), metrics: m('sessions', 'totalUsers', 'engagedSessions', 'keyEvents'), orderBys: desc('sessions'), limit: 40 }),
      R({ dateRanges: cur, dimensions: d('sessionSourceMedium'), metrics: m('sessions', 'totalUsers', 'engagementRate', 'keyEvents'), orderBys: desc('sessions'), limit: 12 }),
      R({ dateRanges: cur, dimensions: d('pagePath', 'pageTitle'), metrics: m('screenPageViews', 'totalUsers', 'userEngagementDuration'), orderBys: desc('screenPageViews'), limit: 12 })
    ]),
    batch(env, token, [
      R({ dateRanges: cur, dimensions: d('landingPage'), metrics: m('sessions', 'engagementRate', 'keyEvents'), orderBys: desc('sessions'), limit: 12 }),
      R({ dateRanges: cur, dimensions: d('eventName'), metrics: m('eventCount', 'totalUsers', 'keyEvents'), orderBys: desc('eventCount'), limit: 15 }),
      R({ dateRanges: cur, dimensions: d('deviceCategory'), metrics: m('sessions', 'engagementRate'), orderBys: desc('sessions') }),
      R({ dateRanges: cur, dimensions: d('city'), metrics: m('totalUsers', 'sessions'), orderBys: desc('totalUsers'), limit: 12 })
    ])
  ]);

  const split = (rs, dimName) => {
    if (!cStart) return { cur: rs, prev: [] };
    return { cur: rs.filter(r => r.dateRange === 'cur'), prev: rs.filter(r => r.dateRange === 'prev') };
  };
  const k = split(rows(b1[0]));
  const daily = split(rows(b1[1]));
  const ch = split(rows(b1[2]));
  const prevCh = Object.fromEntries(ch.prev.map(r => [r.sessionDefaultChannelGroup, r]));
  const fmtDate = (s) => s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);

  return {
    kpis: { cur: kpiObj(k.cur[0]), prev: cStart ? kpiObj(k.prev[0]) : null },
    daily: daily.cur.sort((a, b) => a.date.localeCompare(b.date)).map(r => ({ date: fmtDate(r.date), sessions: r.sessions, users: r.totalUsers })),
    dailyPrev: daily.prev.sort((a, b) => a.date.localeCompare(b.date)).map(r => ({ date: fmtDate(r.date), sessions: r.sessions, users: r.totalUsers })),
    channels: ch.cur.map(r => ({ name: r.sessionDefaultChannelGroup, sessions: r.sessions, users: r.totalUsers, engaged: r.engagedSessions, keyEvents: r.keyEvents,
      prevSessions: prevCh[r.sessionDefaultChannelGroup] ? prevCh[r.sessionDefaultChannelGroup].sessions : (cStart ? 0 : null) })),
    sources: rows(b1[3]).map(r => ({ name: r.sessionSourceMedium, sessions: r.sessions, users: r.totalUsers, engagementRate: r.engagementRate, keyEvents: r.keyEvents })),
    pages: rows(b1[4]).map(r => ({ path: r.pagePath, title: r.pageTitle, views: r.screenPageViews, users: r.totalUsers, avgEngagement: r.totalUsers ? r.userEngagementDuration / r.totalUsers : 0 })),
    landing: rows(b2[0]).filter(r => r.landingPage && r.landingPage !== '(not set)').map(r => ({ path: r.landingPage, sessions: r.sessions, engagementRate: r.engagementRate, keyEvents: r.keyEvents })),
    events: rows(b2[1]).map(r => ({ name: r.eventName, count: r.eventCount, users: r.totalUsers, key: r.keyEvents > 0 })),
    devices: rows(b2[2]).map(r => ({ name: r.deviceCategory, sessions: r.sessions, engagementRate: r.engagementRate })),
    cities: rows(b2[3]).filter(r => r.city && r.city !== '(not set)').map(r => ({ name: r.city, users: r.totalUsers, sessions: r.sessions }))
  };
}
