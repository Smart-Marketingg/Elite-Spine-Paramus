import { json, can, forbidden, clip, audit } from '../../_lib/util.js';
import { getSetting, setSetting } from '../../_lib/automation.js';
import { getAiSettings, AI_DEFAULTS } from '../../_lib/ai.js';

export async function onRequestGet({ env, data }) {
  if (!can(data.user, 'ai')) return forbidden();
  const [s, gbp, last, queue, recent] = await Promise.all([
    getAiSettings(env),
    getSetting(env, 'gbp', null),
    getSetting(env, 'ai_last_run', null),
    env.DB.prepare(`SELECT id, slug, title, excerpt, hero, category, origin_ref, updated_at FROM posts WHERE origin = 'ai' AND review = 'pending' ORDER BY updated_at DESC`).all(),
    env.DB.prepare(`SELECT g.name, g.summary, g.created, g.status, g.error, g.seen_at, g.post_id, p.title AS post_title, p.status AS post_status, p.review AS post_review
                    FROM gbp_posts g LEFT JOIN posts p ON p.id = g.post_id ORDER BY g.seen_at DESC LIMIT 12`).all()
  ]);
  return json({
    settings: s,
    canEdit: can(data.user, 'ai', 'publish'),
    google: { configured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), connected: !!(gbp && gbp.refresh), title: gbp && gbp.title, address: gbp && gbp.address,
      needsLocation: !!(gbp && gbp.refresh && !gbp.location), choices: (gbp && !gbp.location && gbp.choices) || [], connectedBy: gbp && gbp.by },
    claudeReady: !!env.ANTHROPIC_API_KEY,
    cronReady: !!env.CRON_SECRET,
    lastRun: last,
    queue: queue.results,
    recent: recent.results
  });
}

export async function onRequestPut({ request, env, data }) {
  if (!can(data.user, 'ai', 'publish')) return forbidden('Changing AI Writer settings requires AI Writer access and Blog → Publish.');
  const b = await request.json().catch(() => ({}));
  const s = {
    enabled: b.enabled !== false,
    autoPublish: !!b.autoPublish,
    words: [500, 700, 1000].includes(+b.words) ? +b.words : AI_DEFAULTS.words,
    category: clip(b.category, 60) || AI_DEFAULTS.category,
    voice: clip(b.voice, 600) || AI_DEFAULTS.voice,
    notify: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.notify || '').trim()) ? String(b.notify).trim() : '',
    maxPerRun: Math.min(5, Math.max(1, parseInt(b.maxPerRun, 10) || AI_DEFAULTS.maxPerRun))
  };
  await setSetting(env, 'ai_blog', s, data.user.email);
  await audit(env, data.user.email, 'ai.settings', `auto=${s.autoPublish} enabled=${s.enabled}`);
  return json({ ok: true, settings: s });
}
