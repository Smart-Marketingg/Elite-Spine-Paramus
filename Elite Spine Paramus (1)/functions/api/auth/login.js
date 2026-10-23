import { json, superAdmins, crmState, isFrozenSuper, CRM_OFF_MSG } from '../../_lib/util.js';
import { verifyPassword, createSession, tooMany, hit, forget, sameOrigin } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'bad origin' }, 403);
  const b = await request.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!email || !b.password) return json({ error: 'Enter your email and password.' }, 400);
  { const crm = await crmState(env); if (crm.off && (!superAdmins(env).includes(email) || !isFrozenSuper(crm, email))) return json({ error: CRM_OFF_MSG }, 503); }
  if (await tooMany(env, 'e:' + email, 5, 15) || await tooMany(env, 'i:' + ip, 25, 15)) {
    return json({ error: 'Too many sign-in attempts. Wait 15 minutes or reset your password.' }, 429);
  }
  const u = await env.DB.prepare('SELECT email, password_hash, active FROM users WHERE email = ?').bind(email).first();
  const ok = await verifyPassword(b.password, u && u.password_hash);
  if (!u || !ok) {
    await hit(env, 'e:' + email); await hit(env, 'i:' + ip);
    return json({ error: 'That email and password don’t match.' }, 401);
  }
  if (!u.active && !superAdmins(env).includes(email)) return json({ error: 'Your access is paused. Contact your administrator.' }, 403);
  await forget(env, 'e:' + email);
  const cookie = await createSession(env, email, !!b.remember, request);
  return json({ ok: true }, 200, { 'Set-Cookie': cookie });
}
