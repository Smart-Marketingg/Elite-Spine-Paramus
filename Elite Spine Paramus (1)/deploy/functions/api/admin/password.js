// Signed-in user changes (or sets for the first time) their own password.
import { json, audit } from '../../_lib/util.js';
import { verifyPassword, hashPassword, passwordProblem, endAllSessions, tooMany, hit } from '../../_lib/auth.js';

export async function onRequestPost({ request, env, data }) {
  const email = data.user.email;
  const b = await request.json().catch(() => ({}));
  if (await tooMany(env, 'p:' + email, 5, 15)) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
  const u = await env.DB.prepare('SELECT password_hash FROM users WHERE email = ?').bind(email).first();
  if (u && u.password_hash && !(await verifyPassword(b.current, u.password_hash))) {
    await hit(env, 'p:' + email);
    return json({ error: 'Your current password isn’t right.' }, 400);
  }
  const problem = passwordProblem(b.next, email);
  if (problem) return json({ error: problem }, 400);
  const hash = await hashPassword(b.next);
  const r = await env.DB.prepare('UPDATE users SET password_hash = ? WHERE email = ?').bind(hash, email).run();
  if (!r.meta.changes) await env.DB.prepare(`INSERT INTO users (email, name, password_hash, created_by) VALUES (?, 'Super admin', ?, 'super')`).bind(email, hash).run();
  await endAllSessions(env, email, data.session && data.session.id);
  await audit(env, email, 'user.password_change', email);
  return json({ ok: true });
}
