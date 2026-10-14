import { json, audit, can, forbidden } from '../../../_lib/util.js';
import { getPipelines, normalizeRule } from '../../../_lib/automation.js';

export async function onRequestPut({ request, env, params, data }) {
  if (!can(data.user, 'setup')) return forbidden();
  const id = parseInt(params.id, 10);
  let r;
  try { r = normalizeRule(await request.json().catch(() => ({})), await getPipelines(env)); } catch (e) { return json({ error: e.message }, 400); }
  const res = await env.DB.prepare(
    `UPDATE autoreplies SET name=?, enabled=?, trigger=?, forms=?, pipeline=?, stage=?, subject=?, body=?, reply_to=?, updated_by=?,
     updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?`
  ).bind(r.name, r.enabled, r.trigger, r.forms, r.pipeline, r.stage, r.subject, r.body, r.reply_to, data.user.email, id).run();
  if (!res.meta.changes) return json({ error: 'not found' }, 404);
  await audit(env, data.user.email, 'autoreply.update', `${id} enabled=${r.enabled}`);
  return json({ ok: true });
}

export async function onRequestDelete({ env, params, data }) {
  if (!can(data.user, 'setup')) return forbidden();
  const id = parseInt(params.id, 10);
  await env.DB.prepare('DELETE FROM autoreplies WHERE id = ?').bind(id).run();
  await audit(env, data.user.email, 'autoreply.delete', id);
  return json({ ok: true });
}
