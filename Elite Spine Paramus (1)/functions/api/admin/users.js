import { json, audit, can, forbidden, clip, superAdmins, LEVELS, parseOff } from '../../_lib/util.js';
import { createLink, linkUrl, inviteEmail } from '../../_lib/auth.js';
import { sendEmail } from '../../_lib/automation.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeUser(b) {
  return {
    name: clip(b.name, 80),
    leads: LEVELS.leads.includes(b.leads) ? b.leads : 'none',
    blog: LEVELS.blog.includes(b.blog) ? b.blog : 'none',
    users: b.users ? 1 : 0,
    setup: b.setup ? 1 : 0,
    source: b.source === false || b.source === 0 ? 0 : 1,
    off: JSON.stringify(parseOff(b.off))
  };
}

// Creates a fresh invite link and emails it. Returns the link so an admin can also copy it.
export async function sendInvite(env, request, email, name, inviter) {
  const tok = await createLink(env, email, 'invite', inviter.email);
  const url = linkUrl(request, tok);
  // Invites from a super admin are signed by the agency, never by a person.
  const m = inviteEmail(name, inviter.super ? (env.AGENCY_NAME || 'Smart Marketing') : (inviter.name || inviter.email), url);
  const res = await sendEmail(env, { to: email, subject: m.subject, text: m.text });
  return { inviteUrl: url, emailed: res.status === 'sent', emailError: res.status === 'sent' ? null : res.error };
}

export async function onRequestGet({ env, data }) {
  if (!can(data.user, 'users')) return forbidden();
  const supers = superAdmins(env);
  const r = await env.DB.prepare(
    `SELECT email, name, leads, blog, users, setup, source, off, active, created_at, created_by, last_seen,
       (password_hash IS NOT NULL) AS joined,
       (SELECT MAX(expires_at) FROM auth_tokens t WHERE t.email = users.email AND t.kind = 'invite' AND t.used_at IS NULL) AS invite_expires
     FROM users WHERE email NOT IN (${supers.map(() => '?').join(',')}) ORDER BY created_at`
  ).bind(...supers).all();
  const last = await env.DB.prepare(`SELECT email, MAX(last_seen) AS seen FROM sessions GROUP BY email`).all();
  const seen = Object.fromEntries(last.results.map(x => [x.email, x.seen]));
  // Only super admins learn who the super admins are; everyone else sees just the regular team.
  const users = r.results.map(u => ({ ...u, off: parseOff(u.off), joined: !!u.joined, last_seen: seen[u.email] || u.last_seen, created_by: data.user.super ? u.created_by : null }));
  return json({ supers: data.user.super ? supers : [], users });
}

export async function onRequestPost({ request, env, data }) {
  if (!can(data.user, 'users')) return forbidden();
  const b = await request.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  if (!EMAIL.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
  // Same wording as a duplicate so non-super admins can't probe which addresses are super admins.
  if (superAdmins(env).includes(email)) return json({ error: data.user.super ? 'That person is already a super admin.' : 'That email already has access.' }, 409);
  const u = normalizeUser(b);
  if (!data.user.super) { u.source = 1; u.off = '[]'; } // only super admins decide lead-source visibility and hidden sections
  try {
    await env.DB.prepare('INSERT INTO users (email, name, leads, blog, users, setup, source, off, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(email, u.name, u.leads, u.blog, u.users, u.setup, u.source, u.off, data.user.email).run();
  } catch (e) {
    if (String(e).includes('UNIQUE') || String(e).includes('PRIMARY')) return json({ error: 'That email already has access.' }, 409);
    throw e;
  }
  const inv = await sendInvite(env, request, email, u.name, data.user);
  await audit(env, data.user.email, 'user.invite', `${email} leads=${u.leads} blog=${u.blog} users=${u.users} off=${u.off} emailed=${inv.emailed}`);
  return json({ ok: true, ...inv });
}
