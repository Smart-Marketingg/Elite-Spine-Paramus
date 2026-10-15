// Tells the set-password screen whether a link is still valid and what it's for.
import { json } from '../../_lib/util.js';
import { peekLink } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const tok = new URL(request.url).searchParams.get('t');
  const t = await peekLink(env, tok);
  if (!t) return json({ valid: false });
  const u = await env.DB.prepare('SELECT name, password_hash IS NOT NULL AS joined FROM users WHERE email = ?').bind(t.email).first();
  if (!u) return json({ valid: false });
  return json({ valid: true, kind: t.kind, email: t.email, name: u.name || '', joined: !!u.joined });
}
