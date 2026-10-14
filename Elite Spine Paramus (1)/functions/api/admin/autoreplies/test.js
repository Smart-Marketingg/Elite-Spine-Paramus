// Sends the auto-reply (with sample lead details) to the signed-in user's own inbox.
import { json, can, forbidden, clip } from '../../../_lib/util.js';
import { renderTemplate, sendEmail } from '../../../_lib/automation.js';

export async function onRequestPost({ request, env, data }) {
  if (!can(data.user, 'setup')) return forbidden();
  const b = await request.json().catch(() => ({}));
  const sample = { name: 'Alex Sample', service: 'Lower Back Pain', form: 'Appointment Requests' };
  const subject = '[Test] ' + renderTemplate(clip(b.subject, 200) || '', sample);
  const res = await sendEmail(env, { to: data.user.email, subject, text: renderTemplate(clip(b.body, 8000) || '', sample), replyTo: b.reply_to });
  if (res.status !== 'sent') return json({ error: res.error || 'Send failed' }, 400);
  return json({ ok: true, to: data.user.email });
}
