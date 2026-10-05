// Pipelines (configurable lead stages) + auto-reply emails.
import { slugify, clip } from './util.js';

export const PALETTE = ['#ff6a1a', '#6aa7ff', '#4cc38a', '#f4c14a', '#b48cff', '#ff6b6b', '#95a0b3'];

export const DEFAULT_PIPELINES = [{
  id: 'patients', name: 'Patient Leads', default: true, forms: [],
  stages: [
    { key: 'new', label: 'New', color: '#ff6a1a' },
    { key: 'contacted', label: 'Contacted', color: '#6aa7ff' },
    { key: 'booked', label: 'Booked', color: '#4cc38a' },
    { key: 'closed', label: 'Closed', color: '#95a0b3' }
  ]
}];

export async function getSetting(env, key, fallback) {
  try {
    const r = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
    return r ? JSON.parse(r.value) : fallback;
  } catch (_) { return fallback; }
}
export async function setSetting(env, key, value, by) {
  await env.DB.prepare(
    `INSERT INTO settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`
  ).bind(key, JSON.stringify(value), by || null).run();
}

export const getPipelines = (env) => getSetting(env, 'pipelines', DEFAULT_PIPELINES);

export function pipelineFor(pipes, form) {
  return pipes.find(p => !p.default && p.forms.includes(form)) || pipes.find(p => p.default) || pipes[0];
}

// SQL fragment limiting leads to one pipeline's forms.
export function pipelineWhere(pipes, pid) {
  const p = pipes.find(x => x.id === pid) || pipes.find(x => x.default);
  if (!p.default) {
    if (!p.forms.length) return { sql: '1 = 0', args: [], p };
    return { sql: `form IN (${p.forms.map(() => '?').join(',')})`, args: p.forms, p };
  }
  const taken = pipes.filter(x => !x.default).flatMap(x => x.forms);
  if (!taken.length) return { sql: '1 = 1', args: [], p };
  return { sql: `(form IS NULL OR form NOT IN (${taken.map(() => '?').join(',')}))`, args: taken, p };
}

export function validatePipelines(input) {
  if (!Array.isArray(input) || !input.length || input.length > 10) throw new Error('Add between 1 and 10 pipelines.');
  const ids = new Set();
  const formOwner = {};
  const out = input.map((raw, i) => {
    const name = clip(raw.name, 60);
    if (!name) throw new Error('Every pipeline needs a name.');
    let id = slugify(raw.id || name) || 'pipeline-' + (i + 1);
    while (ids.has(id)) id += '-' + (i + 1);
    ids.add(id);
    const stages = (Array.isArray(raw.stages) ? raw.stages : []).slice(0, 12).map((s, j) => {
      const label = clip(s.label, 40);
      if (!label) throw new Error(`Pipeline “${name}”: every stage needs a name.`);
      return { key: slugify(s.key || label).slice(0, 40) || 'stage-' + (j + 1), label, color: PALETTE.includes(s.color) ? s.color : PALETTE[j % PALETTE.length] };
    });
    if (!stages.length) throw new Error(`Pipeline “${name}” needs at least one stage.`);
    const keys = new Set();
    stages.forEach(s => { while (keys.has(s.key)) s.key += '-2'; keys.add(s.key); });
    const forms = [...new Set((Array.isArray(raw.forms) ? raw.forms : []).map(f => clip(f, 120)).filter(Boolean))];
    return { id, name, default: !!raw.default, forms, stages };
  });
  if (out.filter(p => p.default).length !== 1) { out.forEach(p => { p.default = false; }); out[0].default = true; }
  out.forEach(p => {
    if (p.default) { p.forms = []; return; }
    p.forms.forEach(f => {
      if (formOwner[f]) throw new Error(`“${f}” is assigned to two pipelines (${formOwner[f]} and ${p.name}).`);
      formOwner[f] = p.name;
    });
  });
  return out;
}

// After saving pipelines, move any lead whose stage no longer exists into the pipeline's first stage.
export async function reconcileLeads(env, pipes) {
  let moved = 0;
  for (const p of pipes) {
    const w = pipelineWhere(pipes, p.id);
    const keys = p.stages.map(s => s.key);
    const r = await env.DB.prepare(
      `UPDATE leads SET status = ? WHERE ${w.sql} AND status NOT IN (${keys.map(() => '?').join(',')})`
    ).bind(keys[0], ...w.args, ...keys).run();
    moved += r.meta.changes || 0;
  }
  return moved;
}

// ---------- auto-replies ----------
const CLINIC = { phone: '(201) 483-6653', booking: 'https://www.zocdoc.com/practice/elite-spine-and-sports-care-60454', email: 'elitespineparamus@gmail.com' };

export function renderTemplate(tpl, lead) {
  const first = String(lead.name || '').trim().split(/\s+/)[0] || 'there';
  const vars = {
    first_name: first, name: lead.name || 'there', service: lead.service || 'your visit', form: lead.form || 'our website',
    clinic_phone: CLINIC.phone, booking_link: CLINIC.booking
  };
  return String(tpl || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k) => (k.toLowerCase() in vars ? vars[k.toLowerCase()] : m));
}

const escH = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function textToHtml(text) {
  const body = escH(text).split(/\n{2,}/).map(p => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`).join('')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#ff6a1a">$1</a>');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1d2433;max-width:560px;margin:0 auto;padding:24px">${body}
<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12.5px;color:#6b7280">Elite Spine &amp; Sports Care · 37 W Century Rd, Paramus, NJ 07652 · ${CLINIC.phone}</p></div>`;
}

export async function sendEmail(env, { to, subject, text, replyTo }) {
  if (!env.RESEND_API_KEY) return { status: 'skipped', error: 'Email sending is not connected (RESEND_API_KEY missing).' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.MAIL_FROM || 'Elite Spine & Sports Care <hello@elitespineparamus.com>',
        to: [to], subject, text, html: textToHtml(text), reply_to: replyTo || CLINIC.email
      })
    });
    if (r.ok) return { status: 'sent' };
    const d = await r.json().catch(() => ({}));
    return { status: 'failed', error: clip(d.message || 'HTTP ' + r.status, 300) };
  } catch (e) { return { status: 'failed', error: clip(String(e), 300) }; }
}

async function log(env, leadId, ruleId, to, subject, res) {
  await env.DB.prepare('INSERT INTO email_log (lead_id, rule_id, to_email, subject, status, error) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(leadId, ruleId, to, subject, res.status, res.error || null).run().catch(() => {});
}

export function parseRule(r) {
  let forms = [];
  try { forms = JSON.parse(r.forms || '[]'); } catch (_) {}
  return { ...r, enabled: !!r.enabled, forms };
}

// event: { trigger: 'submit' } | { trigger: 'stage', pipeline, stage }
export async function runAutoReplies(env, lead, event) {
  try {
    if (!lead.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return;
    const rows = await env.DB.prepare('SELECT * FROM autoreplies WHERE enabled = 1 AND trigger = ? ORDER BY id').bind(event.trigger).all();
    const rules = rows.results.map(parseRule).filter(r => event.trigger === 'submit'
      ? (!r.forms.length || r.forms.includes(lead.form))
      : (r.pipeline === event.pipeline && r.stage === event.stage));
    if (!rules.length) return;
    // Anti-abuse: at most 3 auto-replies per address per 24h.
    const recent = await env.DB.prepare(`SELECT COUNT(*) AS n FROM email_log WHERE to_email = ? AND status = 'sent' AND at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')`).bind(lead.email).first();
    let budget = 3 - (recent ? recent.n : 0);
    for (const r of rules) {
      if (event.trigger === 'stage') {
        const dup = await env.DB.prepare(`SELECT 1 FROM email_log WHERE lead_id = ? AND rule_id = ? AND status = 'sent'`).bind(lead.id, r.id).first();
        if (dup) continue;
      }
      const subject = renderTemplate(r.subject, lead).slice(0, 200);
      if (budget <= 0) { await log(env, lead.id, r.id, lead.email, subject, { status: 'skipped', error: 'Daily limit for this address reached.' }); continue; }
      const res = await sendEmail(env, { to: lead.email, subject, text: renderTemplate(r.body, lead), replyTo: r.reply_to });
      if (res.status === 'sent') budget--;
      await log(env, lead.id, r.id, lead.email, subject, res);
    }
  } catch (_) { /* never break lead intake */ }
}

export function normalizeRule(b, pipes) {
  const trigger = b.trigger === 'stage' ? 'stage' : 'submit';
  const out = {
    name: clip(b.name, 80), enabled: b.enabled === false ? 0 : 1, trigger,
    forms: JSON.stringify(trigger === 'submit' && Array.isArray(b.forms) ? b.forms.map(f => clip(f, 120)).filter(Boolean).slice(0, 30) : []),
    pipeline: null, stage: null,
    subject: clip(b.subject, 200), body: clip(b.body, 8000),
    reply_to: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.reply_to || '').trim()) ? String(b.reply_to).trim().slice(0, 120) : null
  };
  if (!out.name) throw new Error('Give the auto-reply a name.');
  if (!out.subject || !out.body) throw new Error('Subject and message are required.');
  if (trigger === 'stage') {
    const p = pipes.find(x => x.id === b.pipeline);
    if (!p || !p.stages.some(s => s.key === b.stage)) throw new Error('Pick a pipeline and stage.');
    out.pipeline = p.id; out.stage = b.stage;
  }
  return out;
}
