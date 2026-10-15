// Always answers the same way so it can't be used to discover who has an account.
import { json, superAdmins } from '../../_lib/util.js';
import { createLink, linkUrl, resetEmail, tooMany, hit, sameOrigin } from '../../_lib/auth.js';
import { sendEmail } from '../../_lib/automation.js';

export async function onRequestPost({ request, env, waitUntil }) {
  if (!sameOrigin(request)) return json({ error: 'bad origin' }, 403);
  const b = await request.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const reply = json({ ok: true });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
  if (await tooMany(env, 'f:' + email, 3, 60) || await tooMany(env, 'fi:' + ip, 10, 60)) return reply;
  await hit(env, 'f:' + email); await hit(env, 'fi:' + ip);

  const isSuper = superAdmins(env).includes(email);
  let u = await env.DB.prepare('SELECT email, active FROM users WHERE email = ?').bind(email).first();
  if (!u && isSuper) {
    await env.DB.prepare(`INSERT OR IGNORE INTO users (email, name, created_by) VALUES (?, 'Super admin', 'super')`).bind(email).run();
    u = { email, active: 1 };
  }
  if (!u || (!u.active && !isSuper)) return reply;
  const tok = await createLink(env, email, 'reset', 'self');
  const m = resetEmail(linkUrl(request, tok));
  waitUntil(sendEmail(env, { to: email, subject: m.subject, text: m.text }));
  return reply;
}
