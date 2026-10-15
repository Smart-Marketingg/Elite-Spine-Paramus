// Called every week by the small scheduled Worker in cron-worker/ (needs the shared CRON_SECRET).
import { json } from '../../_lib/util.js';
import { getAiSettings, runWeekly } from '../../_lib/ai.js';

export async function onRequestPost({ request, env }) {
  const secret = request.headers.get('X-Cron-Secret') || '';
  if (!env.CRON_SECRET || secret.length !== env.CRON_SECRET.length || secret !== env.CRON_SECRET) return json({ error: 'unauthorized' }, 401);
  const s = await getAiSettings(env);
  if (!s.enabled) return json({ ok: true, skipped: 'AI Writer is paused' });
  const r = await runWeekly(env, new URL(request.url).origin, 'weekly');
  return json({ ok: true, ...r });
}
