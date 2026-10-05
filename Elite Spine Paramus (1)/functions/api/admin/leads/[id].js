import { json, audit, can, forbidden } from '../../../_lib/util.js';
import { getPipelines, pipelineFor, runAutoReplies } from '../../../_lib/automation.js';

// Auto-reply history for one lead (shown in the lead drawer).
export async function onRequestGet({ env, params, data }) {
  if (!can(data.user, 'leads', 'view')) return forbidden();
  const id = parseInt(params.id, 10);
  const r = await env.DB.prepare(
    `SELECT l.at, l.to_email, l.subject, l.status, l.error, a.name AS rule FROM email_log l LEFT JOIN autoreplies a ON a.id = l.rule_id WHERE l.lead_id = ? ORDER BY l.at DESC LIMIT 50`
  ).bind(id).all();
  return json({ emails: r.results });
}

export async function onRequestPatch({ request, env, params, data, waitUntil }) {
  if (!can(data.user, 'leads', 'manage')) return forbidden();
  const id = parseInt(params.id, 10);
  const body = await request.json().catch(() => ({}));
  const lead = await env.DB.prepare('SELECT id, form, name, email, service, status FROM leads WHERE id = ?').bind(id).first();
  if (!lead) return json({ error: 'not found' }, 404);
  const p = pipelineFor(await getPipelines(env), lead.form);
  if (!p.stages.some(s => s.key === body.status)) return json({ error: 'That stage isn’t in this lead’s pipeline.' }, 400);
  await env.DB.prepare(
    `UPDATE leads SET status = ?, status_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?`
  ).bind(body.status, data.user.email, id).run();
  await audit(env, data.user.email, 'lead.status.' + body.status, id);
  if (lead.status !== body.status) waitUntil(runAutoReplies(env, lead, { trigger: 'stage', pipeline: p.id, stage: body.status }));
  return json({ ok: true });
}

export async function onRequestDelete({ env, params, data }) {
  if (!can(data.user, 'leads', 'manage')) return forbidden();
  const id = parseInt(params.id, 10);
  await env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM email_log WHERE lead_id = ?').bind(id).run().catch(() => {});
  await audit(env, data.user.email, 'lead.delete', id);
  return json({ ok: true });
}
