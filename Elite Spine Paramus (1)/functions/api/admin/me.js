import { json, crmState } from '../../_lib/util.js';
import { integrations, clinic } from '../../_lib/clinic.js';
import { notifyHealth } from '../../_lib/notify.js';

export async function onRequestGet({ env, data }) {
  const u = data.user;
  const row = await env.DB.prepare('SELECT password_hash IS NOT NULL AS has FROM users WHERE email = ?').bind(u.email).first();
  const st = await crmState(env);
  const crm = { off: st.off, by: st.by || null, at: st.at || null };
  const c = clinic(env);
  const out = { email: u.email, name: u.name, super: u.super, hasPassword: !!(row && row.has), crm, clinic: { name: c.name, phone: c.phone, booking: c.booking },
    perms: { leads: u.leads, blog: u.blog, users: u.users, setup: u.setup, source: u.source, off: u.off || [] } };
  // Super admins see what is (not) connected, so a missing Resend key or Turnstile secret is visible in the portal.
  if (u.super) out.health = { ...integrations(env), notifications: await notifyHealth(env) };
  return json(out);
}
