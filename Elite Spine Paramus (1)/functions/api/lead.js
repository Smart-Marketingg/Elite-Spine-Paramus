// Public endpoint: website forms POST here (in addition to the Google Sheet).
import { json, clip, ATTR_FIELDS, classifyChannel, crmState } from '../_lib/util.js';
import { getPipelines, pipelineFor, runAutoReplies } from '../_lib/automation.js';

async function readBody(request) {
  const type = request.headers.get('Content-Type') || '';
  if (type.includes('application/json')) return await request.json();
  const form = await request.formData();
  const o = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') o[k] = v;
  return o;
}

async function recaptchaOk(env, token) {
  if (!env.RECAPTCHA_SECRET) return true; // not configured → skip
  if (!token) return false;
  const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: env.RECAPTCHA_SECRET, response: token })
  });
  const d = await r.json();
  return d.success && (d.score == null || d.score >= 0.5);
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.DB) return json({ ok: false }, 503);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false }, 403);

  let body;
  try { body = await readBody(request); } catch (_) { return json({ ok: false }, 400); }
  if (body.website) return json({ ok: true }); // honeypot
  if (!(await recaptchaOk(env, body._recaptcha))) return json({ ok: false, error: 'recaptcha' }, 400);

  const fields = {};
  const attr = {};
  let n = 0;
  for (const [k, v] of Object.entries(body)) {
    if (k.startsWith('_')) continue;
    if (ATTR_FIELDS.includes(k)) { attr[k] = clip(v, 300); continue; }
    if (n >= 40) continue;
    fields[clip(k, 60)] = clip(v, 4000);
    n++;
  }
  if (!fields.email && !fields.phone) return json({ ok: false, error: 'contact required' }, 400);

  // CRM shut down: accept the form but don't store it. The site's Google Sheet copy still emails the clinic.
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

  const lead = { id: r.meta.last_row_id, form, name: fields.name, email: fields.email, service: fields.service };
  waitUntil(runAutoReplies(env, lead, { trigger: 'submit' }));

  return json({ ok: true });
}
