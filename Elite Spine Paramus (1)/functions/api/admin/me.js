import { json } from '../../_lib/util.js';

export async function onRequestGet({ env, data }) {
  const u = data.user;
  const row = await env.DB.prepare('SELECT password_hash IS NOT NULL AS has FROM users WHERE email = ?').bind(u.email).first();
  return json({ email: u.email, name: u.name, super: u.super, hasPassword: !!(row && row.has),
    perms: { leads: u.leads, blog: u.blog, users: u.users, setup: u.setup, source: u.source } });
}
