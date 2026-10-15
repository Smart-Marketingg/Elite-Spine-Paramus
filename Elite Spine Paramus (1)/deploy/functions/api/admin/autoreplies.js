import { json, audit, can, forbidden } from '../../_lib/util.js';
import { getPipelines, normalizeRule, parseRule } from '../../_lib/automation.js';

export async function onRequestGet({ env, data }) {
  if (!can(data.user, 'replies')) return forbidden();
  const [rules, stats] = await Promise.all([
    env.DB.prepare('SELECT * FROM autoreplies ORDER BY id').all(),
    env.DB.prepare(`SELECT rule_id, COUNT(*) AS n, MAX(at) AS last FROM email_log WHERE status = 'sent' AND at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 day') GROUP BY rule_id`).all()
  ]);
  const byRule = Object.fromEntries(stats.results.map(s => [s.rule_id, s]));
  return json({
    rules: rules.results.map(r => ({ ...parseRule(r), sent30: byRule[r.id] ? byRule[r.id].n : 0, lastSent: byRule[r.id] ? byRule[r.id].last : null })),
    mailReady: !!env.RESEND_API_KEY,
    from: env.MAIL_FROM || 'Elite Spine & Sports Care <hello@elitespineparamus.com>'
  });
}

export async function onRequestPost({ request, env, data }) {
  if (!can(data.user, 'replies')) return forbidden();
  let r;
  try { r = normalizeRule(await request.json().catch(() => ({})), await getPipelines(env)); } catch (e) { return json({ error: e.message }, 400); }
  const res = await env.DB.prepare(
    'INSERT INTO autoreplies (name, enabled, trigger, forms, pipeline, stage, subject, body, reply_to, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(r.name, r.enabled, r.trigger, r.forms, r.pipeline, r.stage, r.subject, r.body, r.reply_to, data.user.email).run();
  await audit(env, data.user.email, 'autoreply.add', r.name);
  return json({ ok: true, id: res.meta.last_row_id });
}
