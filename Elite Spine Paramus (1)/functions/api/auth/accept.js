// Accept an invite or finish a password reset, then sign the person in.
import { json, clip, audit } from '../../_lib/util.js';
import { useLink, hashPassword, passwordProblem, endAllSessions, createSession, sameOrigin } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'bad origin' }, 403);
  const b = await request.json().catch(() => ({}));
  const t = await useLink(env, String(b.token || ''));
  if (!t) return json({ error: 'This link has expired or was already used. Ask for a new one.' }, 400);
  const problem = passwordProblem(b.password, t.email);
  if (problem) {
    // Give the link back so they can try again.
    await env.DB.prepare('UPDATE auth_tokens SET used_at = NULL WHERE token_hash = ?').bind(t.token_hash).run();
    return json({ error: problem }, 400);
  }
  const hash = await hashPassword(b.password);
  const name = t.kind === 'invite' ? clip(b.name, 80) : null;
  const r = await env.DB.prepare('UPDATE users SET password_hash = ?, name = COALESCE(?, name) WHERE email = ?').bind(hash, name, t.email).run();
  if (!r.meta.changes) return json({ error: 'This account no longer exists.' }, 400);
  await env.DB.prepare('DELETE FROM auth_tokens WHERE email = ? AND used_at IS NULL').bind(t.email).run();
  await endAllSessions(env, t.email);
  await audit(env, t.email, t.kind === 'invite' ? 'user.joined' : 'user.password_reset', t.email);
  const cookie = await createSession(env, t.email, false, request);
  return json({ ok: true }, 200, { 'Set-Cookie': cookie });
}
