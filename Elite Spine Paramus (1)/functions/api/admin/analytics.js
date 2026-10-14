import { json, can, forbidden } from '../../_lib/util.js';
import { gaReport } from '../../_lib/ga.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const day = 864e5;
const toISO = (t) => new Date(t).toISOString().slice(0, 10);

export async function onRequestGet({ request, env, data, waitUntil }) {
  if (!can(data.user, 'leads', 'view') || !can(data.user, 'source')) return forbidden('Analytics needs Leads access with lead sources visible.');
  const url = new URL(request.url);
  const start = url.searchParams.get('start') || '', end = url.searchParams.get('end') || '';
  const compare = url.searchParams.get('compare') || 'previous';
  const channel = (url.searchParams.get('channel') || '').slice(0, 60);
  if (!ISO.test(start) || !ISO.test(end) || start > end) return json({ error: 'Pick a valid date range.' }, 400);
  const s = Date.parse(start + 'T00:00:00Z'), e = Date.parse(end + 'T00:00:00Z');
  const len = Math.round((e - s) / day) + 1;
  if (len > 731) return json({ error: 'Pick a range of 2 years or less.' }, 400);

  let cStart = null, cEnd = null;
  if (compare === 'previous') { cEnd = toISO(s - day); cStart = toISO(s - len * day); }
  else if (compare === 'year') { const y = (t) => { const d = new Date(t); d.setUTCFullYear(d.getUTCFullYear() - 1); return toISO(d); }; cStart = y(s); cEnd = y(e); }

  // Website form leads from the CRM for the same window.
  const leadWin = async (a, b) => {
    try {
      const where = `created_at >= ? AND created_at < ?`;
      const args = [a + 'T00:00:00Z', toISO(Date.parse(b + 'T00:00:00Z') + day) + 'T00:00:00Z'];
      const [t, by] = await Promise.all([
        env.DB.prepare(`SELECT COUNT(*) AS n FROM leads WHERE ${where}`).bind(...args).first(),
        env.DB.prepare(`SELECT COALESCE(channel, 'Direct') AS name, COUNT(*) AS n FROM leads WHERE ${where} GROUP BY 1 ORDER BY n DESC`).bind(...args).all()
      ]);
      return { total: t ? t.n : 0, byChannel: by.results };
    } catch (_) { return { total: 0, byChannel: [] }; }
  };
  const [leads, leadsPrev] = await Promise.all([leadWin(start, end), cStart ? leadWin(cStart, cEnd) : null]);
  const base = { range: { start, end, days: len }, compare: cStart ? { start: cStart, end: cEnd, mode: compare } : null, channel, leads: { ...leads, prev: leadsPrev ? leadsPrev.total : null } };

  const missing = ['GA_SERVICE_ACCOUNT', 'GA4_PROPERTY_ID'].filter(k => !env[k] || String(env[k]).startsWith('REPLACE'));
  if (missing.length) return json({ ...base, configured: false, missing });

  // 15-minute cache per query (GA quota friendly).
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const ck = new Request('https://ga-cache.internal/r?' + new URLSearchParams({ p: env.GA4_PROPERTY_ID, start, end, c: compare, ch: channel }));
  let ga = null;
  if (cache && url.searchParams.get('fresh') !== '1') { const hit = await cache.match(ck); if (hit) ga = await hit.json(); }
  if (!ga) {
    try { ga = await gaReport(env, { start, end, cStart, cEnd, channel }); }
    catch (err) { return json({ ...base, configured: true, error: err.message }, 502); }
    if (cache) waitUntil(cache.put(ck, new Response(JSON.stringify(ga), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=900' } })));
  }
  return json({ ...base, configured: true, fetchedAt: new Date().toISOString(), ...ga });
}
