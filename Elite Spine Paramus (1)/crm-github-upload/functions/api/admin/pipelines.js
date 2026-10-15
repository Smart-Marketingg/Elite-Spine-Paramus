import { json, audit, can, forbidden } from '../../_lib/util.js';
import { getPipelines, setSetting, validatePipelines, reconcileLeads } from '../../_lib/automation.js';

export async function onRequestGet({ env, data }) {
  if (!can(data.user, 'leads', 'view') && !can(data.user, 'setup')) return forbidden();
  const [pipelines, forms] = await Promise.all([
    getPipelines(env),
    env.DB.prepare('SELECT DISTINCT form FROM leads WHERE form IS NOT NULL ORDER BY form').all()
  ]);
  return json({ pipelines, forms: forms.results.map(r => r.form) });
}

export async function onRequestPut({ request, env, data }) {
  if (!can(data.user, 'setup')) return forbidden('Editing pipelines requires Setup access.');
  const b = await request.json().catch(() => ({}));
  let pipes;
  try { pipes = validatePipelines(b.pipelines); } catch (e) { return json({ error: e.message }, 400); }
  await setSetting(env, 'pipelines', pipes, data.user.email);
  const moved = await reconcileLeads(env, pipes);
  await audit(env, data.user.email, 'pipelines.update', `${pipes.length} pipelines, ${moved} leads moved`);
  return json({ ok: true, pipelines: pipes, moved });
}
