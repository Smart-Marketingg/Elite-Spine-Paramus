// Public: published posts whose publish date has arrived (scheduling = publish_at in the future).
import { json } from '../_lib/util.js';

const LIVE = `status = 'published' AND (publish_at IS NULL OR publish_at <= strftime('%Y-%m-%dT%H:%M:%SZ','now'))`;

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ posts: [] });
  const slug = new URL(request.url).searchParams.get('slug');
  const cache = { 'Cache-Control': 'public, max-age=60' };
  if (slug) {
    const p = await env.DB.prepare(`SELECT slug, title, excerpt, body_html, category, tags, hero, seo_title, seo_description, publish_at FROM posts WHERE slug = ? AND ${LIVE}`).bind(slug).first();
    return p ? json({ post: p }, 200, cache) : json({ error: 'not found' }, 404);
  }
  const r = await env.DB.prepare(`SELECT slug, title, excerpt, category, hero, publish_at, LENGTH(body_html) AS len FROM posts WHERE ${LIVE} ORDER BY publish_at DESC LIMIT 50`).all();
  return json({ posts: r.results }, 200, cache);
}
