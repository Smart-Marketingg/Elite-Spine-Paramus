import { json, can, forbidden, audit } from '../../../_lib/util.js';

export async function onRequestPost({ request, env, data }) {
  if (!can(data.user, 'blog', 'publish')) return forbidden('Approving posts requires Blog → Publish access.');
  const b = await request.json().catch(() => ({}));
  const id = parseInt(b.id, 10);
  const p = await env.DB.prepare(`SELECT id, slug FROM posts WHERE id = ? AND origin = 'ai'`).bind(id).first();
  if (!p) return json({ error: 'not found' }, 404);
  if (b.action === 'approve') {
    await env.DB.prepare(`UPDATE posts SET status = 'published', publish_at = COALESCE(publish_at, strftime('%Y-%m-%dT%H:%M:%SZ','now')), review = 'approved', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?`).bind(id).run();
    await audit(env, data.user.email, 'ai.post.approved', p.slug);
    return json({ ok: true });
  }
  if (b.action === 'reject') {
    await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
    await env.DB.prepare(`UPDATE gbp_posts SET status = 'rejected', post_id = NULL WHERE post_id = ?`).bind(id).run();
    await audit(env, data.user.email, 'ai.post.rejected', p.slug);
    return json({ ok: true });
  }
  return json({ error: 'bad action' }, 400);
}
