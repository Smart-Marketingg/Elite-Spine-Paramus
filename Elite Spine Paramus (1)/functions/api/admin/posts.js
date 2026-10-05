import { json, audit, slugify, sanitizeHtml, clip, can, forbidden } from '../../_lib/util.js';

export function normalizePost(b) {
  const title = clip(b.title, 200);
  return {
    title,
    slug: slugify(b.slug || title),
    excerpt: clip(b.excerpt, 400),
    body_html: sanitizeHtml(b.body_html),
    category: clip(b.category, 80),
    tags: Array.isArray(b.tags) ? b.tags.map(t => clip(t, 40)).filter(Boolean).slice(0, 12).join(',') : clip(b.tags, 500),
    hero: clip(b.hero, 500),
    seo_title: clip(b.seo_title, 70),
    seo_description: clip(b.seo_description, 170),
    status: b.status === 'published' ? 'published' : 'draft',
    publish_at: clip(b.publish_at, 40)
  };
}

export async function onRequestGet({ env, data }) {
  if (!can(data.user, 'blog', 'write')) return forbidden();
  const r = await env.DB.prepare(
    'SELECT id, slug, title, excerpt, category, tags, hero, status, publish_at, author, updated_at, created_at FROM posts ORDER BY COALESCE(publish_at, updated_at, created_at) DESC'
  ).all();
  return json({ posts: r.results });
}

export async function onRequestPost({ request, env, data }) {
  const p = normalizePost(await request.json().catch(() => ({})));
  if (!can(data.user, 'blog', 'write')) return forbidden();
  if (p.status === 'published' && !can(data.user, 'blog', 'publish')) return forbidden('You can save drafts. Ask a publisher to publish it.');
  if (!p.title || !p.slug) return json({ error: 'title required' }, 400);
  if (p.status === 'published' && !p.publish_at) p.publish_at = new Date().toISOString();
  try {
    const r = await env.DB.prepare(
      `INSERT INTO posts (slug, title, excerpt, body_html, category, tags, hero, seo_title, seo_description, status, publish_at, author, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))`
    ).bind(p.slug, p.title, p.excerpt, p.body_html, p.category, p.tags, p.hero, p.seo_title, p.seo_description, p.status, p.publish_at, data.user.email).run();
    await audit(env, data.user.email, 'post.create', p.slug);
    return json({ ok: true, id: r.meta.last_row_id, slug: p.slug });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return json({ error: 'That URL slug is already used by another post.' }, 409);
    throw e;
  }
}
