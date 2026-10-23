// Public endpoint: website forms POST here. Turnstile + honeypot + per-IP rate limit, then
// the lead is stored in D1, the clinic is emailed (Resend) and auto-replies run.
import { json, clip, ATTR_FIELDS, classifyChannel, crmState } from '../_lib/util.js';
import { getPipelines, pipelineFor, runAutoReplies } from '../_lib/automation.js';
import { notifyNewLead } from '../_lib/notify.js';
import { tooMany, hit, sha256 } from '../_lib/auth.js';

const RATE_MAX = 8;        // submissions per IP ...
const RATE_MINUTES = 10;   // ... per window

async function readBody(request) {
  const type = request.headers.get('Content-Type') || '';
  if (type.includes('application/json')) return await request.json();
  const form = await request.formData();
  const o = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') o[k] = v;
  return o;
}

// Cloudflare Turnstile. Skipped (allowed) until TURNSTILE_SECRET is set, so forms keep working
// before the widget exists; once the secret is there, a missing/invalid token is rejected.
export async function turnstileOk(env, token, ip, fetcher = fetch) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  try {
    const r = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip || undefined })
    });
    const d = await r.json();
    return !!d.success;
  } catch (_) { return false; }
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.DB) return json({ ok: false }, 503);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false }, 403);

  let body;
  try { body = await readBody(request); } catch (_) { return json({ ok: false }, 400); }
  if (clip(body.website, 50)) return json({ ok: true }); // honeypot: bots get a quiet success

  const ip = request.headers.get('CF-Connecting-IP') || '';
  const ipKey = 'lead:' + (await sha256(ip || 'unknown'));
  if (await tooMany(env, ipKey, RATE_MAX, RATE_MINUTES)) return json({ ok: false, error: 'rate_limited', message: 'Too many submissions. Please try again in a few minutes.' }, 429);
  await hit(env, ipKey);

  if (!(await turnstileOk(env, clip(body['cf-turnstile-response'], 4000), ip))) {
    return json({ ok: false, error: 'turnstile', message: 'Please complete the verification and try again.' }, 400);
  }

  const fields = {};
  const attr = {};
  let n = 0;
  for (const [k, v] of Object.entries(body)) {
    if (k.startsWith('_') || k === 'cf-turnstile-response' || k === 'website') continue;
    if (ATTR_FIELDS.includes(k)) { attr[k] = clip(v, 300); continue; }
    if (n >= 40) continue;
    fields[clip(k, 60)] = clip(v, 4000);
    n++;
  }
  if (!fields.email && !fields.phone) return json({ ok: false, error: 'contact required', message: 'Add a phone number or email so we can reach you.' }, 400);

  // CRM shut down: accept the form but don't store it.
  if ((await crmState(env)).off) return json({ ok: true });

  const form = clip(body._tab, 120) || 'Website';
  const pipes = await getPipelines(env);
  const status = pipelineFor(pipes, form).stages[0].key;

  const clickId = attr.gclid ? 'gclid:' + attr.gclid : attr.gbraid ? 'gbraid:' + attr.gbraid : attr.wbraid ? 'wbraid:' + attr.wbraid
    : attr.msclkid ? 'msclkid:' + attr.msclkid : attr.fbclid ? 'fbclid:' + attr.fbclid : null;

  const r = await env.DB.prepare(
    `INSERT INTO leads (form, source, name, email, phone, service, message, data, status,
       channel, utm_source, utm_medium, utm_campaign, utm_term, utm_content, click_id, referrer, landing_page, first_touch, first_seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    form, clip(body._source, 200),
    fields.name || null, fields.email || null, fields.phone || null, fields.service || null, fields.message || null,
    JSON.stringify(fields), status,
    classifyChannel(attr), attr.utm_source || null, attr.utm_medium || null, attr.utm_campaign || null, attr.utm_term || null, attr.utm_content || null,
    clickId, attr.referrer || null, attr.landing_page || null, attr.first_touch || null, attr.first_seen || null
  ).run();

  const id = r.meta.last_row_id;
  const lead = {
    id, created_at: new Date().toISOString(), form, source: clip(body._source, 200),
    name: fields.name, email: fields.email, phone: fields.phone, service: fields.service, message: fields.message, data: fields,
    channel: classifyChannel(attr), utm_source: attr.utm_source, utm_medium: attr.utm_medium, utm_campaign: attr.utm_campaign
  };
  waitUntil(notifyNewLead(env, lead));
  waitUntil(runAutoReplies(env, lead, { trigger: 'submit' }));

  return json({ ok: true, id });
}
