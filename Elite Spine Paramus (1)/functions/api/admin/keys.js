// Connections setup: super admins add or change API keys from the portal.
import { json, audit, forbidden, clip } from '../../_lib/util.js';
import { getSetting, setSetting } from '../../_lib/automation.js';
import { KEY_NAMES, sealKey, clearKeyCache } from '../../_lib/keys.js';
import { redirectUri } from '../../_lib/ai.js';

const fromApp = (env, k) => (env.__fromApp || []).includes(k);
const status = (env, request) => {
  const keys = {};
  for (const k of KEY_NAMES) {
    const v = env[k] || '';
    keys[k] = { set: !!v, from: !v ? null : fromApp(env, k) ? 'app' : 'cloudflare', hint: v ? '…' + v.slice(-4) : '' };
  }
  return { keys, redirectUri: redirectUri(request), origin: new URL(request.url).origin };
};

export async function onRequestGet({ request, env, data }) {
  if (!data.user.super) return forbidden('Only a super admin can manage connections.');
  return json(status(env, request));
}

export async function onRequestPut({ request, env, data }) {
  if (!data.user.super) return forbidden('Only a super admin can manage connections.');
  const b = await request.json().catch(() => ({}));
  const name = String(b.name || '');
  if (!KEY_NAMES.includes(name)) return json({ error: 'Unknown key.' }, 400);
  if (env[name] && !fromApp(env, name)) return json({ error: 'This key is set in Cloudflare (Variables and Secrets), which overrides the portal. Change or remove it there.' }, 409);
  const value = clip(String(b.value || '').trim(), 400);

  if (value && name === 'ANTHROPIC_API_KEY') {
    const r = await fetch('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': value, 'anthropic-version': '2023-06-01' } }).catch(() => null);
    if (!r) return json({ error: 'Couldn’t reach Anthropic to check the key. Try again.' }, 502);
    if (r.status === 401 || r.status === 403) return json({ error: 'Anthropic rejected that key. Copy it again from console.anthropic.com → API keys.' }, 400);
  }
  if (value && name === 'GOOGLE_CLIENT_ID' && !/\.apps\.googleusercontent\.com$/.test(value)) {
    return json({ error: 'That doesn’t look like a Google OAuth Client ID (it ends in .apps.googleusercontent.com).' }, 400);
  }

  const cur = await getSetting(env, 'api_keys', {}) || {};
  if (value) cur[name] = await sealKey(env, value); else delete cur[name];
  await setSetting(env, 'api_keys', cur, data.user.email);
  // The saved Google connection is encrypted with the client secret, so a new secret means reconnecting.
  if (name === 'GOOGLE_CLIENT_SECRET' || name === 'GOOGLE_CLIENT_ID') await setSetting(env, 'gbp', null, data.user.email);
  clearKeyCache();
  await audit(env, data.user.email, value ? 'key.set' : 'key.remove', name);

  const next = { ...env, __fromApp: (env.__fromApp || []).filter(k => k !== name) };
  if (value) { next[name] = value; next.__fromApp.push(name); } else next[name] = '';
  return json({ ok: true, ...status(next, request) });
}
