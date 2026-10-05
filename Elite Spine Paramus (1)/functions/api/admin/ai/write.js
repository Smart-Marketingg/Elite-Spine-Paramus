// Write a post from pasted text (a Google post, a note, or a topic).
import { json, can, forbidden, clip } from '../../../_lib/util.js';
import { getAiSettings, claudeWrite, savePost } from '../../../_lib/ai.js';

export async function onRequestPost({ request, env, data }) {
  if (!can(data.user, 'blog', 'write')) return forbidden();
  const b = await request.json().catch(() => ({}));
  const text = clip(b.text, 3000);
  if (!text || text.length < 20) return json({ error: 'Paste the Google post or describe the topic (at least a sentence).' }, 400);
  const s = await getAiSettings(env);
  // Writers without publish rights always get a draft for review.
  if (!can(data.user, 'blog', 'publish') || b.review) s.autoPublish = false;
  try {
    const draft = await claudeWrite(env, s, { kind: b.kind === 'gbp' ? 'gbp' : 'note', text, type: 'STANDARD' });
    const saved = await savePost(env, s, draft, { media: null, ref: b.kind === 'gbp' ? 'manual-gbp' : 'manual' }, data.user.email);
    return json({ ok: true, ...saved });
  } catch (e) { return json({ error: e.message }, 502); }
}
