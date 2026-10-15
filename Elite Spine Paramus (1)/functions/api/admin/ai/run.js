// "Check Google now": same as the weekly job.
import { json, can, forbidden } from '../../../_lib/util.js';
import { runWeekly } from '../../../_lib/ai.js';

export async function onRequestPost({ request, env, data }) {
  if (!can(data.user, 'ai', 'publish')) return forbidden();
  const r = await runWeekly(env, new URL(request.url).origin, data.user.email);
  return json({ ok: !r.error || r.created.length > 0, ...r });
}
