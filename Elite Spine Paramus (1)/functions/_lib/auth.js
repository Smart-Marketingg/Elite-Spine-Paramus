// Portal accounts: password hashing, sessions, one-time links, rate limiting.
const enc = new TextEncoder();
const COOKIE = 'es_session';
const ITER = 100000; // PBKDF2-SHA256 (Workers maximum)

export const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
export function randomToken(n = 32) { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64u(a); }
export async function sha256(s) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const now = () => new Date().toISOString();
const later = (ms) => new Date(Date.now() + ms).toISOString();

async function derive(pw, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}
export async function hashPassword(pw) {
  const salt = new Uint8Array(16); crypto.getRandomValues(salt);
  return `pbkdf2$${ITER}$${b64u(salt)}$${b64u(await derive(pw, salt, ITER))}`;
}
function same(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
const DUMMY = 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export async function verifyPassword(pw, stored) {
  const [alg, it, salt, hash] = String(stored || DUMMY).split('$');
  if (alg !== 'pbkdf2' || !salt || !hash) return false;
  const got = b64u(await derive(String(pw), fromB64u(salt), Math.min(+it || ITER, ITER)));
  return !!stored && same(got, hash);
}

const COMMON = ['password', 'password1', 'password123', '1234567890', 'qwertyuiop', 'elitespine', 'letmein123', 'welcome123', 'paramus123'];
export function passwordProblem(pw, email) {
  pw = String(pw || '');
  if (pw.length < 10) return 'Use at least 10 characters.';
  if (pw.length > 200) return 'That password is too long.';
  if (COMMON.includes(pw.toLowerCase())) return 'That password is too common. Pick something harder to guess.';
  const local = String(email || '').split('@')[0].toLowerCase();
  if (local.length > 3 && pw.toLowerCase().includes(local)) return 'Don’t include your email name in the password.';
  return null;
}

// ---------- sessions ----------
export function readCookie(request) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  return m ? m[1] : null;
}
export async function createSession(env, email, remember, request) {
  const tok = randomToken();
  const ttl = remember ? 30 * 864e5 : 12 * 3600e3;
  await env.DB.prepare('INSERT INTO sessions (id_hash, email, expires_at, last_seen, ip, ua) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(await sha256(tok), email, later(ttl), now(), request.headers.get('CF-Connecting-IP') || null, (request.headers.get('User-Agent') || '').slice(0, 200)).run();
  return `${COOKIE}=${tok}; Path=/; HttpOnly; Secure; SameSite=Strict${remember ? '; Max-Age=' + 30 * 86400 : ''}`;
}
export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export async function getSession(env, request) {
  const tok = readCookie(request);
  if (!tok) return null;
  const id = await sha256(tok);
  const s = await env.DB.prepare('SELECT email, expires_at, last_seen, created_at FROM sessions WHERE id_hash = ?').bind(id).first();
  if (!s) return null;
  if (s.expires_at < now()) { await env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(id).run(); return null; }
  // Idle sign-out: IDLE_MINUTES (default 30) without a request ends the session.
  // "Remember me" sessions (30-day expiry) get a 7-day idle window instead.
  const idleMs = idleLimitMs(env, s);
  const seen = new Date(s.last_seen || s.created_at || 0).getTime();
  if (seen && Date.now() - seen > idleMs) { await env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(id).run(); return null; }
  if (!s.last_seen || Date.now() - seen > 60e3) {
    env.DB.prepare('UPDATE sessions SET last_seen = ? WHERE id_hash = ?').bind(now(), id).run().catch(() => {});
  }
  return { email: s.email, id };
}
export function idleLimitMs(env, s) {
  const remember = (new Date(s.expires_at).getTime() - new Date(s.created_at || s.last_seen || Date.now()).getTime()) > 13 * 3600e3;
  if (remember) return 7 * 864e5;
  const m = Number(env && env.IDLE_MINUTES);
  return (m > 0 ? m : 30) * 60e3;
}
export const pruneSessions = (env) => env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now()).run().catch(() => {});
export async function endSession(env, request) {
  const tok = readCookie(request);
  if (tok) await env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(await sha256(tok)).run();
}
export async function endAllSessions(env, email, exceptId) {
  if (exceptId) await env.DB.prepare('DELETE FROM sessions WHERE email = ? AND id_hash != ?').bind(email, exceptId).run();
  else await env.DB.prepare('DELETE FROM sessions WHERE email = ?').bind(email).run();
}

// ---------- one-time links (invite / reset) ----------
export async function createLink(env, email, kind, by) {
  const tok = randomToken();
  const ttl = kind === 'invite' ? 7 * 864e5 : 3600e3;
  await env.DB.prepare('DELETE FROM auth_tokens WHERE email = ? AND kind = ? AND used_at IS NULL').bind(email, kind).run();
  await env.DB.prepare('INSERT INTO auth_tokens (token_hash, email, kind, expires_at, created_by) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256(tok), email, kind, later(ttl), by || null).run();
  return tok;
}
export async function peekLink(env, tok) {
  if (!tok || tok.length > 100) return null;
  const t = await env.DB.prepare('SELECT token_hash, email, kind, expires_at, used_at FROM auth_tokens WHERE token_hash = ?').bind(await sha256(tok)).first();
  if (!t || t.used_at || t.expires_at < now()) return null;
  return t;
}
export async function useLink(env, tok) {
  const t = await peekLink(env, tok);
  if (!t) return null;
  const r = await env.DB.prepare('UPDATE auth_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL').bind(now(), t.token_hash).run();
  return r.meta.changes ? t : null;
}
// Token rides in the URL fragment: never sent to servers, logs, or Referer headers.
export const linkUrl = (request, tok) => new URL(request.url).origin + '/admin/#set=' + encodeURIComponent(tok);

// ---------- rate limiting ----------
export async function tooMany(env, key, max, minutes) {
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM login_attempts WHERE key = ? AND at > ?`).bind(key, new Date(Date.now() - minutes * 60e3).toISOString()).first();
  return (r ? r.n : 0) >= max;
}
export async function hit(env, key) {
  await env.DB.prepare('INSERT INTO login_attempts (key, at) VALUES (?, ?)').bind(key, now()).run();
  if (Math.random() < 0.05) env.DB.prepare('DELETE FROM login_attempts WHERE at < ?').bind(new Date(Date.now() - 864e5).toISOString()).run().catch(() => {});
}
export const forget = (env, key) => env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run();

// Sign-in endpoints: the portal always sends Origin + X-Requested-With: crm (see _lib/headers.js).
export { csrfOk as sameOrigin } from './headers.js';

// ---------- emails ----------
export function inviteEmail(name, inviter, url) {
  return {
    subject: 'You’re invited to the Elite Spine team portal',
    text: `Hi ${name || 'there'},\n\n${inviter} invited you to the Elite Spine & Sports Care team portal, where the team follows up on website leads and manages the blog.\n\nSet your password to get started (this link expires in 7 days):\n${url}\n\nIf you weren’t expecting this, you can ignore this email.\n\nElite Spine & Sports Care`
  };
}
export function resetEmail(url) {
  return {
    subject: 'Reset your Elite Spine portal password',
    text: `We received a request to reset the password for your Elite Spine & Sports Care team portal account.\n\nChoose a new password here (this link expires in 1 hour and works once):\n${url}\n\nIf you didn’t ask for this, you can ignore this email. Your password won’t change.\n\nElite Spine & Sports Care`
  };
}
