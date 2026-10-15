// Public read-only access to uploaded blog images in R2.
export async function onRequestGet({ env, params }) {
  if (!env.MEDIA) return new Response('Not found', { status: 404 });
  const key = (Array.isArray(params.path) ? params.path.join('/') : params.path) || '';
  if (!key.startsWith('blog/') && !key.startsWith('ai/')) return new Response('Not found', { status: 404 });
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('ETag', obj.httpEtag);
  h.set('X-Content-Type-Options', 'nosniff');
  return new Response(obj.body, { headers: h });
}
