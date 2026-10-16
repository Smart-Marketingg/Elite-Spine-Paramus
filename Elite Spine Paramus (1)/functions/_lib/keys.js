// API keys entered in the portal (super admins only). Stored encrypted in D1.
// A key set in Cloudflare (Variables and Secrets) always wins over one saved here.
import { getSetting } from './automation.js';

export const KEY_NAMES = ['ANTHROPIC_API_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
let cache = null, cachedAt = 0;

async function aes(env) {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('es-keys:' + (env.SETTINGS_KEY || 'elitespine')));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const toB64 = (u8) => btoa(String.fromCharCode(...u8));
const fromB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function sealKey(env, plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aes(env), new TextEncoder().encode(plain)));
  return toB64(iv) + '.' + toB64(ct);
}
async function openKey(env, sealed) {
  const [iv, ct] = String(sealed).split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, await aes(env), fromB64(ct));
  return new TextDecoder().decode(pt);
}

export async function storedKeys(env, fresh) {
  if (!fresh && cache && Date.now() - cachedAt < 60e3) return cache;
  const v = await getSetting(env, 'api_keys', {}) || {};
  const out = {};
  for (const k of KEY_NAMES) if (v[k]) { try { out[k] = await openKey(env, v[k]); } catch (_) {} }
  cache = out; cachedAt = Date.now();
  return out;
}
export const clearKeyCache = () => { cache = null; };

// Fills in any key missing from Cloudflare with the one saved in the portal.
export async function withKeys(env) {
  if (!env.DB || KEY_NAMES.every(k => env[k])) return env;
  let s = {};
  try { s = await storedKeys(env); } catch (_) {}
  const extra = {};
  for (const k of KEY_NAMES) if (!env[k] && s[k]) extra[k] = s[k];
  return Object.assign({}, env, extra, { __fromApp: Object.keys(extra) });
}
