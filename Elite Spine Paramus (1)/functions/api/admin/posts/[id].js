import { json, audit, can, forbidden } from '../../../_lib/util.js';
import { normalizePost } from '../posts.js';

export async function onRequestGet({ env, params, data }) {
  if (!can(data.user, 'blog', 'write')) return forbidden();
  const p = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(parseInt(params.id, 10)).first();
  return p ? json({ post: p }) : json({ error: 'not found' }, 404);
}

export async function onRequestPut({ request, env, params, data }) {
  if (!can(data.user, 'blog', 'write')) return forbidden();
  const id = parseInt(params.id, 10);
  const p = normalizePost(await request.json().catch(() => ({})));
  if (!can(data.user, 'blog', 'publish')) {
    const cur = await env.DB.prepare('SELECT status FROM posts WHERE id = ?').bind(id).first();
    if (cur && cur.status === 'published') return forbidden('Only publishers can edit published or scheduled posts.');
    if (p.status === 'published') return forbidden('You can save drafts. Ask a publisher to publish it.');
  }
  if (!p.title || !p.slug) return json({ error: 'title required' }, 400);
  if (p.status === 'published' && !p.publish_at) p.publish_at = new Date().toISOString();
  try {
    const r = await env.DB.prepare(
      `UPDATE posts SET slug=?, title=?, excerpt=?, body_html=?, category=?, tags=?, hero=?, seo_title=?, seo_description=?, status=?, publish_at=?,
       review = CASE WHEN ? = 'published' AND review = 'pending' THEN 'approved' ELSE review END,
       updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?`
    ).bind(p.slug, p.title, p.excerpt, p.body_html, p.category, p.tags, p.hero, p.seo_title, p.seo_description, p.status, p.publish_at, p.status, id).run();
    if (!r.meta.changes) return json({ error: 'not found' }, 404);
    await audit(env, data.user.email, 'post.update.' + p.status, p.slug);
    return json({ ok: true, id, slug: p.slug });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return json({ error: 'That URL slug is already used by another post.' }, 409);
    throw e;
  }
}

export async function onRequestDelete({ env, params, data }) {
  if (!can(data.user, 'blog', 'publish')) return forbidden('Only publishers can delete posts.');
  const id = parseInt(params.id, 10);
  await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
  await audit(env, data.user.email, 'post.delete', id);
  return json({ ok: true });
}
