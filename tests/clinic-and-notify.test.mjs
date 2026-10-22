import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clinic, notifyRecipients, splitEmails, integrations } from '../Elite Spine Paramus (1)/functions/_lib/clinic.js';
import { notificationEmail, NOTIFY_RULE_ID } from '../Elite Spine Paramus (1)/functions/_lib/notify.js';
import { renderTemplate, textToHtml } from '../Elite Spine Paramus (1)/functions/_lib/automation.js';

const env = {
  SITE_URL: 'https://www.elitespineparamus.com/', BUSINESS_NAME: 'Elite Spine & Sports Care', BUSINESS_PHONE: '(201) 483-6653',
  BUSINESS_ADDRESS: '37 W Century Rd, Paramus, NJ 07652', NOTIFY_EMAILS: 'Front@Clinic.com, owner@clinic.com; bad-address',
  NOTIFY_ROUTES: '{"Vein Screening":"veins@clinic.com"}', MAIL_FROM: 'Elite <hello@elitespineparamus.com>', TIMEZONE: 'America/New_York'
};

test('clinic() reads vars with safe defaults', () => {
  const c = clinic(env);
  assert.equal(c.site, 'https://www.elitespineparamus.com');
  assert.equal(c.phone, '(201) 483-6653');
  assert.equal(c.from, 'Elite <hello@elitespineparamus.com>');
  assert.equal(clinic({}).name, 'Elite Spine & Sports Care');
  assert.match(clinic({}).from, /hello@elitespineparamus\.com/);
});

test('notification recipients: list parsing, per-form routes, dedupe', () => {
  assert.deepEqual(splitEmails(' A@x.com,, b@y.org ;c@z.net '), ['a@x.com', 'b@y.org', 'c@z.net']);
  assert.deepEqual(notifyRecipients(env, 'Appointment Requests'), ['front@clinic.com', 'owner@clinic.com']);
  assert.deepEqual(notifyRecipients(env, 'vein screening'), ['veins@clinic.com']);
  assert.deepEqual(notifyRecipients({ NOTIFY_ROUTES: '{bad', NOTIFY_EMAILS: 'a@b.co' }, 'x'), ['a@b.co']);
  assert.deepEqual(notifyRecipients({}, 'x'), []);
});

test('notification email escapes input and links to the lead', () => {
  const lead = { id: 42, created_at: '2026-10-22T14:00:00Z', form: 'Appointment Requests', source: 'sciatica-treatment-paramus-nj.html',
    name: 'Ana <b>Ruiz</b>', email: 'ana@example.com', phone: '(201) 555-0100', service: 'Sciatica', message: 'Pain down my <left> leg', data: JSON.stringify({ insurance: 'Aetna' }),
    channel: 'Google Ads', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'sciatica' };
  const m = notificationEmail(env, lead);
  assert.equal(m.subject, 'New Appointment Requests lead: Ana <b>Ruiz</b>');
  assert.ok(!m.html.includes('<b>Ruiz</b>'), 'name is escaped');
  assert.ok(m.html.includes('&lt;left&gt;'), 'message is escaped');
  assert.ok(m.html.includes('/admin/#lead=42'));
  assert.ok(m.html.includes('Insurance') && m.html.includes('Aetna'), 'extra fields appear');
  assert.ok(m.html.includes('source google'));
  assert.ok(m.html.includes("font-family:Arial"), 'table-based inline-styled email');
  assert.ok(!m.html.includes('<script'));
  assert.equal(m.replyTo, 'ana@example.com');
  assert.match(m.text, /Phone: \(201\) 555-0100/);
  assert.equal(NOTIFY_RULE_ID, 0);
  const anon = notificationEmail(env, { id: 1, form: 'Website', phone: '2015550100' });
  assert.equal(anon.subject, 'New Website lead: 2015550100');
});

test('auto-reply templates use clinic vars', () => {
  const out = renderTemplate('Hi {{first_name}}, call {{clinic_phone}} or book: {{booking_link}} — {{clinic_name}} {{unknown}}', { name: 'Sam Lee' }, { BUSINESS_PHONE: '555', BOOKING_URL: 'https://b.example', BUSINESS_NAME: 'Clinic X' });
  assert.equal(out, 'Hi Sam, call 555 or book: https://b.example — Clinic X {{unknown}}');
  const html = textToHtml('Hello <you>\n\nSee https://x.example', { BUSINESS_NAME: 'Clinic & Co', BUSINESS_ADDRESS: '1 Main', BUSINESS_PHONE: '555' });
  assert.ok(html.includes('&lt;you&gt;') && html.includes('href="https://x.example"') && html.includes('Clinic &amp; Co · 1 Main · 555'));
});

test('integrations() never leaks values', () => {
  const i = integrations({ RESEND_API_KEY: 're_secret', TURNSTILE_SECRET: 's', TURNSTILE_SITE_KEY: 'k', NOTIFY_EMAILS: 'a@b.co' });
  assert.deepEqual(i, { resend: true, turnstile: true, notify: ['a@b.co'], ga4: false, anthropic: false, google: false });
  assert.equal(JSON.stringify(i).includes('re_secret'), false);
  assert.equal(integrations({ TURNSTILE_SECRET: 's' }).turnstile, false, 'needs both site key and secret');
});
