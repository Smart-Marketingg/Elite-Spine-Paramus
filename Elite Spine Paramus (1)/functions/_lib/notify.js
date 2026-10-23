// "New lead" email to the clinic (Resend). Logged in email_log with rule_id = 0 so the
// Auto-replies log and the 15-minute retry job can tell notifications apart from auto-replies.
import { clinic, notifyRecipients } from './clinic.js';
import { clip } from './util.js';

export const NOTIFY_RULE_ID = 0;
const MAX_ATTEMPTS = 4;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const F = "font-family:Arial,Helvetica,sans-serif;";
const LABELS = { name: 'Name', email: 'Email', phone: 'Phone', service: 'Service', message: 'Message' };
const label = (k) => LABELS[k] || String(k).replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase());

export function fmtWhen(iso, tz) {
  try { return new Date(iso).toLocaleString('en-US', { timeZone: tz, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch (_) { return String(iso || ''); }
}

// lead: { id, created_at, form, source, name, email, phone, service, message, data(JSON string|object), channel, utm_*, landing_page, referrer }
export function notificationEmail(env, lead) {
  const c = clinic(env);
  let extra = {};
  try { extra = typeof lead.data === 'string' ? JSON.parse(lead.data || '{}') : (lead.data || {}); } catch (_) { extra = {}; }
  const rows = [];
  const seen = new Set(['message']);
  for (const k of ['name', 'phone', 'email', 'service']) { seen.add(k); if (lead[k] || extra[k]) rows.push([label(k), lead[k] || extra[k], k]); }
  for (const [k, v] of Object.entries(extra)) { if (seen.has(k) || v == null || v === '') continue; seen.add(k); rows.push([label(k), v]); }
  rows.push(['Form', lead.form || 'Website']);
  if (lead.source) rows.push(['Page', lead.source]);
  rows.push(['Received', fmtWhen(lead.created_at || new Date().toISOString(), c.tz)]);
  const attr = [lead.channel, lead.utm_source && 'source ' + lead.utm_source, lead.utm_medium && 'medium ' + lead.utm_medium, lead.utm_campaign && 'campaign ' + lead.utm_campaign].filter(Boolean).join(' · ');
  if (attr) rows.push(['Attribution', attr]);

  const link = `${c.site}/admin/#lead=${lead.id}`;
  const who = lead.name || lead.email || lead.phone || 'Website visitor';
  const subject = `New ${lead.form || 'website'} lead: ${who}`;
  const cell = (k, v, type, i) => {
    let val = esc(v);
    if (type === 'email') val = `<a href="mailto:${esc(v)}" style="color:${c.color};text-decoration:none;">${val}</a>`;
    if (type === 'phone') val = `<a href="tel:${esc(String(v).replace(/[^\d+]/g, ''))}" style="color:${c.color};text-decoration:none;">${val}</a>`;
    const bg = i % 2 ? '#ffffff' : '#f7f8fa';
    return `<tr><td bgcolor="${bg}" style="padding:10px 14px;${F}font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;width:36%;border-bottom:1px solid #e5e7eb;">${esc(k)}</td>` +
      `<td bgcolor="${bg}" style="padding:10px 14px;${F}font-size:15px;color:#1d2433;border-bottom:1px solid #e5e7eb;">${val}</td></tr>`;
  };
  const msg = lead.message ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;"><tr><td bgcolor="#fff4ee" style="background:#fff4ee;border-left:3px solid ${c.color};padding:16px 18px;">` +
    `<p style="margin:0 0 6px;${F}font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${c.color};">Message</p>` +
    `<p style="margin:0;${F}font-size:15px;line-height:1.65;color:#1d2433;white-space:pre-wrap;">${esc(lead.message)}</p></td></tr></table>` : '';
  const btn = (href, text, primary) => `<td style="padding:0 10px 0 0;"><a href="${esc(href)}" style="display:inline-block;padding:12px 20px;border-radius:6px;${F}font-size:14px;font-weight:700;text-decoration:none;background:${primary ? c.color : '#ffffff'};color:${primary ? '#ffffff' : c.color};border:1px solid ${c.color};">${esc(text)}</a></td>`;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body bgcolor="#eef1f5" style="margin:0;padding:0;background:#eef1f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef1f5"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr><td align="center" style="padding:0 0 20px;${F}font-size:20px;font-weight:800;color:#1d2433;">${esc(c.name)}</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:32px 32px 26px;">
<p style="margin:0 0 12px;${F}font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${c.color};">${esc(lead.form || 'Website')}</p>
<h1 style="margin:0 0 14px;${F}font-size:28px;line-height:1.15;color:#1d2433;">${esc(who)}</h1>
<p style="margin:0 0 20px;${F}font-size:15px;line-height:1.6;color:#4b5563;">A new lead just came in from the website.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:6px;border-collapse:separate;overflow:hidden;">${rows.map(([k, v, t], i) => cell(k, v, t, i)).join('')}</table>
${msg}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;"><tr>${lead.email ? btn(`mailto:${lead.email}?subject=${encodeURIComponent('Re: your request — ' + c.name)}`, 'Reply by email', true) : ''}${lead.phone ? btn('tel:' + String(lead.phone).replace(/[^\d+]/g, ''), 'Call ' + (lead.name || '').split(/\s+/)[0] || 'Call', !lead.email) : ''}${btn(link, 'Open in CRM', !lead.email && !lead.phone)}</tr></table>
</td></tr>
<tr><td align="center" style="padding:22px 12px 0;${F}font-size:12px;line-height:1.7;color:#6b7280;"><strong>${esc(c.name)}</strong><br>${esc(c.address)} · ${esc(c.phone)}<br><a href="${esc(c.site)}" style="color:${c.color};text-decoration:none;">${esc(c.site.replace(/^https?:\/\//, ''))}</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${subject}\n\n` + rows.map(([k, v]) => `${k}: ${v}`).join('\n') + (lead.message ? `\n\nMessage:\n${lead.message}` : '') + `\n\nOpen in CRM: ${link}`;
  return { subject, html, text, replyTo: lead.email || undefined };
}

async function resend(env, { to, subject, html, text, replyTo }) {
  if (!env.RESEND_API_KEY) return { status: 'skipped', error: 'RESEND_API_KEY is not set.' };
  const c = clinic(env);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: c.from, to, subject, html, text, reply_to: replyTo || c.email })
    });
    if (r.ok) return { status: 'sent' };
    const d = await r.json().catch(() => ({}));
    return { status: 'failed', error: clip(d.message || 'HTTP ' + r.status, 300) };
  } catch (e) { return { status: 'failed', error: clip(String(e), 300) }; }
}

async function log(env, leadId, to, subject, res) {
  await env.DB.prepare('INSERT INTO email_log (lead_id, rule_id, to_email, subject, status, error) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(leadId, NOTIFY_RULE_ID, to, subject, res.status, res.error || null).run().catch(() => {});
}

/** Email the clinic about one lead. Never throws. */
export async function notifyNewLead(env, lead) {
  try {
    const to = notifyRecipients(env, lead.form);
    if (!to.length) return { status: 'skipped', error: 'NOTIFY_EMAILS is empty.' };
    const m = notificationEmail(env, lead);
    const res = await resend(env, { ...m, to });
    await log(env, lead.id, to.join(', '), m.subject, res);
    return res;
  } catch (e) { return { status: 'failed', error: String(e) }; }
}

/** Cron: resend notifications that failed in the last 24 h (max 4 tries per lead). */
export async function retryFailedNotifications(env) {
  if (!env.RESEND_API_KEY) return { retried: 0 };
  const rows = await env.DB.prepare(
    `SELECT lead_id, COUNT(*) AS tries FROM email_log
      WHERE rule_id = ? AND at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')
      GROUP BY lead_id
      HAVING SUM(status = 'sent') = 0 AND COUNT(*) < ? LIMIT 20`
  ).bind(NOTIFY_RULE_ID, MAX_ATTEMPTS).all();
  let retried = 0;
  for (const r of rows.results || []) {
    const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(r.lead_id).first();
    if (!lead) continue;
    await notifyNewLead(env, lead);
    retried++;
  }
  return { retried };
}

/** Portal health: last 24 h of notification sends. */
export async function notifyHealth(env) {
  const r = await env.DB.prepare(
    `SELECT SUM(status = 'sent') AS sent, SUM(status = 'failed') AS failed, SUM(status = 'skipped') AS skipped, MAX(CASE WHEN status != 'sent' THEN error END) AS last_error
       FROM email_log WHERE rule_id = ? AND at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')`
  ).bind(NOTIFY_RULE_ID).first().catch(() => null);
  return { sent: (r && r.sent) || 0, failed: (r && r.failed) || 0, skipped: (r && r.skipped) || 0, lastError: (r && r.last_error) || null };
}
