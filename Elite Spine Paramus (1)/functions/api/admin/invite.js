// Resend an invite (new link; any older invite link stops working).
import { json, audit, can, forbidden, superAdmins } from '../../_lib/util.js';
import { sendInvite } from './users.js';

export async function onRequestPost({ request, env, data }) {
  if (!can(data.user, 'users')) return forbidden();
  const b = await request.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  if (superAdmins(env).includes(email)) return forbidden();
  const u = await env.DB.prepare('SELECT name, password_hash IS NOT NULL AS joined FROM users WHERE email = ?').bind(email).first();
  if (!u) return json({ error: 'not found' }, 404);
  if (u.joined) return json({ error: 'They already set a password. They can use “Forgot password” on the sign-in page.' }, 409);
  const inv = await sendInvite(env, request, email, u.name, data.user);
  await audit(env, data.user.email, 'user.reinvite', email);
  return json({ ok: true, ...inv });
}
