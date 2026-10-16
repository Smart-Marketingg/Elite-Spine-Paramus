import { json, crmState } from '../../_lib/util.js';

export async function onRequestGet({ env, data }) {
  const u = data.user;
  const row = await env.DB.prepare('SELECT password_hash IS NOT NULL AS has FROM users WHERE email = ?').bind(u.email).first();
  const st = await crmState(env);
  const crm = { off: st.off, by: st.by || null, at: st.at || null };
  return json({ email: u.email, name: u.name, super: u.super, hasPassword: !!(row && row.has), crm,
    perms: { leads: u.leads, blog: u.blog, users: u.users, setup: u.setup, source: u.source, off: u.off || [] } });
}
