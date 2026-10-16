// CRM shutdown switch. Super admins only, and both directions need the super admin's password.
// PUT { off: true,  password }  → shut down: signs out everyone except super admins, pauses automations,
//                                 and freezes the list of super admins as it is right now.
// PUT { off: false, password }  → back on. Needs the password of the super admin who shut it down,
//                                 checked against the password hash stored in the database.
import { json, audit, forbidden, superAdmins, crmState } from '../../_lib/util.js';
import { verifyPassword, tooMany, hit, forget } from '../../_lib/auth.js';

export async function onRequestGet({ env, data }) {
  if (!data.user.super) return forbidden('Only a super admin can do that.');
  const s = await crmState(env);
  return json({ off: s.off, by: s.by || null, at: s.at || null });
}

async function passwordOk(env, email, password) {
  const key = 'crm:' + email;
  if (await tooMany(env, key, 5, 15)) return { error: 'Too many wrong passwords. Wait 15 minutes.', status: 429 };
  const row = await env.DB.prepare('SELECT password_hash FROM users WHERE email = ?').bind(email).first();
  if (!row || !row.password_hash) return { error: 'This super admin has no password set yet. Set one under Change password first.', status: 400 };
  if (!(await verifyPassword(String(password || ''), row.password_hash))) { await hit(env, key); return { error: 'Wrong password.', status: 403 }; }
  await forget(env, key);
  return null;
}

export async function onRequestPut({ request, env, data }) {
  if (!data.user.super) return forbidden('Only a super admin can do that.');
  const b = await request.json().catch(() => ({}));
  const off = b.off === true;
  const cur = await crmState(env);
  if (off === cur.off) return json({ off: cur.off, by: cur.by || null, at: cur.at || null, signedOut: 0 });

  // Turning back on: only the super admin who shut it down, with their own password.
  const who = off ? data.user.email : cur.by;
  if (!off && data.user.email !== cur.by) return forbidden(`Only ${cur.by} can turn the CRM back on.`);
  const bad = await passwordOk(env, who, b.password);
  if (bad) { await audit(env, data.user.email, off ? 'crm.shutdown.denied' : 'crm.restore.denied', bad.error); return json({ error: bad.error }, bad.status); }

  const value = JSON.stringify(off
    ? { off: true, by: data.user.email, at: new Date().toISOString(), supers: superAdmins(env) }
    : { off: false });
  await env.DB.prepare(`INSERT INTO settings (key, value, updated_by, updated_at) VALUES ('crm_state', ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`).bind(value, data.user.email).run();
  let signedOut = 0;
  if (off) {
    const supers = superAdmins(env);
    const r = await env.DB.prepare(`DELETE FROM sessions WHERE email NOT IN (${supers.map(() => '?').join(',')})`).bind(...supers).run();
    signedOut = r.meta.changes || 0;
  }
  await audit(env, data.user.email, off ? 'crm.shutdown' : 'crm.restore', off ? `signed out ${signedOut} session(s)` : '');
  const s = await crmState(env);
  return json({ off: s.off, by: s.by || null, at: s.at || null, signedOut });
}
