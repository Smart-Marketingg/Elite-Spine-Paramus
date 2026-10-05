import { verifyAccess } from '../../_lib/access.js';
import { getSession } from '../../_lib/auth.js';
import { json, loadUser } from '../../_lib/util.js';

export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (!env.DB) return json({ error: 'DB binding missing' }, 500);
  if (request.method !== 'GET') {
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) return json({ error: 'bad origin' }, 403);
  }
  const session = await getSession(env, request);
  let email = session && session.email;
  // Optional fallback while moving off Cloudflare Access (only if it's still configured).
  if (!email && env.CF_ACCESS_AUD) { const id = await verifyAccess(request, env); email = id && id.email; }
  if (!email) return json({ error: 'unauthorized' }, 401);
  const user = await loadUser(env, email);
  if (!user) return json({ error: 'no_access', email }, 403);
  ctx.data.user = user;
  ctx.data.session = session;
  return ctx.next();
}
