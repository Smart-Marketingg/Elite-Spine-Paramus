// GET /api/health — is the Worker wired up? Booleans only, never values.
import { json } from '../_lib/util.js';
import { integrations } from '../_lib/clinic.js';

export async function onRequestGet({ env }) {
  let db = false;
  try { db = !!env.DB && !!(await env.DB.prepare('SELECT 1 AS ok').first()); } catch (_) { db = false; }
  const i = integrations(env);
  return json({ ok: db, db, settings_key: !!env.SETTINGS_KEY, integrations: { resend: i.resend, turnstile: i.turnstile, ga4: i.ga4, anthropic: i.anthropic, google: i.google, notify: i.notify.length > 0 } });
}
