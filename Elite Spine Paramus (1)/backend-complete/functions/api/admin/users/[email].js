import { json, audit, can, forbidden, superAdmins } from '../../../_lib/util.js';
import { normalizeUser } from '../users.js';

function target(params, env) {
  const email = decodeURIComponent(params.email || '').toLowerCase();
  return { email, isSuper: superAdmins(env).includes(email) };
}

export async function onRequestPut({ request, env, params, data }) {
  if (!can(data.user, 'users')) return forbidden();
  const t = target(params, env);
  if (t.isSuper) return forbidden('Super admins can’t be changed here.');
  const b = await request.json().catch(() => ({}));
  const u = normalizeUser(b);
  if (t.email === data.user.email && !u.users) return forbidden('You can’t remove your own user-management access.');
  const active = b.active === false ? 0 : 1;
  // Only super admins can change lead-source + sidebar visibility; others keep the current values.
  if (!data.user.super) {
    const cur = await env.DB.prepare('SELECT source, off FROM users WHERE email = ?').bind(t.email).first();
    if (cur) { u.source = cur.source; u.off = cur.off || '[]'; }
  }
  const r = await env.DB.prepare('UPDATE users SET name = ?, leads = ?, blog = ?, users = ?, setup = ?, source = ?, off = ?, active = ? WHERE email = ?')
    .bind(u.name, u.leads, u.blog, u.users, u.setup, u.source, u.off, active, t.email).run();
  if (!r.meta.changes) return json({ error: 'not found' }, 404);
  if (!active) await env.DB.prepare('DELETE FROM sessions WHERE email = ?').bind(t.email).run();
  await audit(env, data.user.email, 'user.update', `${t.email} leads=${u.leads} blog=${u.blog} users=${u.users} setup=${u.setup} source=${u.source} off=${u.off} active=${active}`);
  return json({ ok: true });
}

export async function onRequestDelete({ env, params, data }) {
  if (!can(data.user, 'users')) return forbidden();
  const t = target(params, env);
  if (t.isSuper) return forbidden('Super admins can’t be removed here.');
  if (t.email === data.user.email) return forbidden('You can’t remove yourself.');
  await env.DB.prepare('DELETE FROM users WHERE email = ?').bind(t.email).run();
  await env.DB.prepare('DELETE FROM sessions WHERE email = ?').bind(t.email).run();
  await env.DB.prepare('DELETE FROM auth_tokens WHERE email = ?').bind(t.email).run();
  await audit(env, data.user.email, 'user.remove', t.email);
  return json({ ok: true });
}
