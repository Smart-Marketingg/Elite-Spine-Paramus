import { verifyAccess } from '../../_lib/access.js';
import { getSession } from '../../_lib/auth.js';
import { json, loadUser, sectionFor, crmState, isFrozenSuper, CRM_OFF_MSG } from '../../_lib/util.js';
import { csrfOk } from '../../_lib/headers.js';

export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (!env.DB) return json({ error: 'DB binding missing' }, 500);
  // Writes need a same-origin Origin header AND the portal's X-Requested-With: crm marker (CSRF).
  if (!csrfOk(request) || (!['GET', 'HEAD'].includes(request.method) && (request.headers.get('X-Requested-With') || '').toLowerCase() !== 'crm')) {
    return json({ error: 'bad origin' }, 403);
  }
  const session = await getSession(env, request);
  let email = session && session.email;
  // Optional fallback while moving off Cloudflare Access (only if it's still configured).
  if (!email && env.CF_ACCESS_AUD) { const id = await verifyAccess(request, env); email = id && id.email; }
  if (!email) return json({ error: 'unauthorized' }, 401);
  const user = await loadUser(env, email);
  if (!user) return json({ error: 'no_access', email }, 403);
  const crm = await crmState(env);
  if (crm.off && (!user.super || !isFrozenSuper(crm, user.email))) return json({ error: 'crm_off', message: CRM_OFF_MSG }, 503);
  const section = sectionFor(new URL(request.url).pathname, request.method);
  if (section && !user.super && user.off.includes(section)) return json({ error: 'That section is turned off for your account.' }, 403);
  ctx.data.user = user;
  ctx.data.session = session;
  return ctx.next();
}
