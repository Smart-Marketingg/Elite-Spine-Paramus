import { audit, can, forbidden } from '../../../_lib/util.js';
import { buildLeadQuery, SOURCE_COLS } from '../leads.js';

const ALL_COLS = ['id', 'created_at', 'status', 'form', 'name', 'phone', 'email', 'service', 'message', 'channel', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'click_id', 'referrer', 'landing_page', 'first_touch', 'first_seen', 'source', 'status_by', 'updated_at'];

function cell(v) {
  if (v == null) return '';
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // block spreadsheet formula injection
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export async function onRequestGet({ request, env, data }) {
  if (!can(data.user, 'leads', 'manage')) return forbidden('Exporting leads requires Manage access.');
  const url = new URL(request.url);
  const seeSource = can(data.user, 'source');
  if (!seeSource) { url.searchParams.delete('channel'); url.searchParams.delete('campaign'); }
  const COLS = seeSource ? ALL_COLS : ALL_COLS.filter(c => !SOURCE_COLS.includes(c));
  const { sql, args } = await buildLeadQuery(url, env, seeSource);
  const rows = await env.DB.prepare(`SELECT * FROM leads${sql} ORDER BY created_at DESC`).bind(...args).all();
  const lines = [COLS.join(',')].concat(rows.results.map(r => COLS.map(c => cell(r[c])).join(',')));
  await audit(env, data.user.email, 'lead.export', rows.results.length);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response('\uFEFF' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="elite-spine-leads-${stamp}.csv"`,
      'Cache-Control': 'no-store'
    }
  });
}
