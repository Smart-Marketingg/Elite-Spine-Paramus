import { json, can, forbidden } from '../../_lib/util.js';
import { getPipelines, pipelineWhere } from '../../_lib/automation.js';

export async function buildLeadQuery(url, env, seeSource = true) {
  const pipes = await getPipelines(env);
  const w = pipelineWhere(pipes, url.searchParams.get('pipeline') || '');
  const q = (url.searchParams.get('q') || '').trim();
  const form = url.searchParams.get('form') || '';
  const status = url.searchParams.get('status') || '';
  const channel = url.searchParams.get('channel') || '';
  const campaign = url.searchParams.get('campaign') || '';
  const where = [w.sql];
  const args = [...w.args];
  if (q) {
    const like = `%${q}%`;
    if (seeSource) { where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ? OR service LIKE ? OR message LIKE ? OR utm_campaign LIKE ? OR utm_source LIKE ?)'); args.push(like, like, like, like, like, like, like); }
    else { where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ? OR service LIKE ? OR message LIKE ?)'); args.push(like, like, like, like, like); }
  }
  if (form) { where.push('form = ?'); args.push(form); }
  if (status) { where.push('status = ?'); args.push(status); }
  if (channel) { where.push("COALESCE(channel, 'Direct') = ?"); args.push(channel); }
  if (campaign) { where.push('utm_campaign = ?'); args.push(campaign); }
  return { sql: ' WHERE ' + where.join(' AND '), args, pipes, pipeline: w.p, base: w };
}

export const SOURCE_COLS = ['channel', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'click_id', 'referrer', 'landing_page', 'first_touch', 'first_seen'];

export async function onRequestGet({ request, env, data }) {
  if (!can(data.user, 'leads', 'view')) return forbidden();
  const url = new URL(request.url);
  const seeSource = can(data.user, 'source');
  if (!seeSource) { url.searchParams.delete('channel'); url.searchParams.delete('campaign'); }
  const { sql, args, pipes, pipeline, base } = await buildLeadQuery(url, env, seeSource);
  const limit = Math.min(300, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));

  const [rows, total, counts, forms, chans, camps] = await Promise.all([
    env.DB.prepare(`SELECT * FROM leads${sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...args, limit, offset).all(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM leads${sql}`).bind(...args).first(),
    env.DB.prepare(`SELECT status, COUNT(*) AS n FROM leads WHERE ${base.sql} GROUP BY status`).bind(...base.args).all(),
    env.DB.prepare(`SELECT DISTINCT form FROM leads WHERE form IS NOT NULL AND ${base.sql} ORDER BY form`).bind(...base.args).all(),
    env.DB.prepare(`SELECT COALESCE(channel, 'Direct') AS channel, COUNT(*) AS n FROM leads WHERE ${base.sql} GROUP BY 1 ORDER BY n DESC`).bind(...base.args).all(),
    env.DB.prepare(`SELECT utm_campaign AS campaign, COUNT(*) AS n FROM leads WHERE utm_campaign IS NOT NULL AND ${base.sql} GROUP BY 1 ORDER BY n DESC LIMIT 100`).bind(...base.args).all()
  ]);

  const byStatus = Object.fromEntries(pipeline.stages.map(s => [s.key, 0]));
  for (const r of counts.results) if (r.status in byStatus) byStatus[r.status] = r.n;

  // Unworked leads (first stage) across every pipeline, for the sidebar badge.
  let fresh = 0;
  for (const p of pipes) {
    const w = pipelineWhere(pipes, p.id);
    const c = await env.DB.prepare(`SELECT COUNT(*) AS n FROM leads WHERE ${w.sql} AND status = ?`).bind(...w.args, p.stages[0].key).first();
    fresh += c ? c.n : 0;
  }

  return json({
    leads: rows.results.map(r => { const o = { ...r, data: safeParse(r.data) }; if (!seeSource) SOURCE_COLS.forEach(c => delete o[c]); return o; }),
    total: total.n,
    counts: byStatus,
    forms: forms.results.map(r => r.form),
    channels: seeSource ? chans.results : [],
    campaigns: seeSource ? camps.results : [],
    pipelines: pipes,
    pipeline: pipeline.id,
    fresh
  });
}

function safeParse(s) { try { return JSON.parse(s || '{}'); } catch (_) { return {}; } }
