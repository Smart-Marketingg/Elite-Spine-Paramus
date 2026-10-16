import { json, audit, can, forbidden } from '../../_lib/util.js';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' };

export async function onRequestPost({ request, env, data }) {
  if (!can(data.user, 'blog', 'write')) return forbidden();
  if (!env.MEDIA) return json({ error: 'MEDIA (R2) binding missing' }, 500);
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ error: 'no file' }, 400);
  const ext = TYPES[file.type];
  if (!ext) return json({ error: 'Images only (JPG, PNG, WebP, AVIF, GIF).' }, 415);
  if (file.size > 5 * 1024 * 1024) return json({ error: 'Max 5 MB per image.' }, 413);
  const base = String(file.name || 'image').replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'image';
  const key = `blog/${Date.now()}-${base}.${ext}`;
  await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' } });
  await audit(env, data.user.email, 'media.upload', key);
  // Public CDN address (media.elitespineparamus.com) when set; previews fall back to /media/ through the Worker.
  const url = env.MEDIA_URL ? String(env.MEDIA_URL).replace(/\/+$/, '') + '/' + key : '/media/' + key;
  return json({ ok: true, url });
}
