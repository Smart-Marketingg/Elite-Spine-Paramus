import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySecurityHeaders, csrfOk, adminCsp, isPrivatePath } from '../Elite Spine Paramus (1)/functions/_lib/headers.js';
import { idleLimitMs } from '../Elite Spine Paramus (1)/functions/_lib/auth.js';
import { turnstileOk } from '../Elite Spine Paramus (1)/functions/api/lead.js';

const req = (method, headers = {}, url = 'https://www.elitespineparamus.com/api/admin/leads') => new Request(url, { method, headers });

test('CSRF: writes need same-origin Origin or the crm marker; reads pass', () => {
  assert.ok(csrfOk(req('GET')));
  assert.ok(csrfOk(req('POST', { Origin: 'https://www.elitespineparamus.com' })));
  assert.ok(csrfOk(req('POST', { 'X-Requested-With': 'crm' })));
  assert.ok(csrfOk(req('POST', { Referer: 'https://www.elitespineparamus.com/admin/' })));
  assert.ok(!csrfOk(req('POST')));
  assert.ok(!csrfOk(req('POST', { Origin: 'https://evil.example', 'X-Requested-With': 'crm' })));
  assert.ok(!csrfOk(req('DELETE', { Referer: 'https://evil.example/' })));
  // workers.dev previews work because the check is against the request's own origin
  assert.ok(csrfOk(req('POST', { Origin: 'https://x.workers.dev' }, 'https://x.workers.dev/api/admin/leads')));
});

test('security headers: strict set on /admin and /api, basic set elsewhere', () => {
  const r = applySecurityHeaders(new Response('x', { headers: { 'Content-Type': 'text/html' } }), '/admin/', { MEDIA_URL: 'https://media.elitespineparamus.com/' });
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.equal(r.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  const csp = r.headers.get('Content-Security-Policy');
  assert.match(csp, /script-src 'self';/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.ok(csp.includes('https://media.elitespineparamus.com'));
  assert.ok(!csp.includes("script-src 'self' 'unsafe-inline'"));
  const m = applySecurityHeaders(new Response('x'), '/media/a.jpg', {});
  assert.ok(!m.headers.get('Content-Security-Policy'));
  assert.equal(m.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.ok(m.headers.get('Strict-Transport-Security').includes('max-age=31536000'));
  assert.ok(isPrivatePath('/api/lead') && isPrivatePath('/admin') && !isPrivatePath('/adminx'));
  assert.ok(!adminCsp({}).includes('undefined'));
});

test('idle limits: 30 min default, env override, 7 days for remember-me', () => {
  const short = { created_at: '2026-01-01T00:00:00Z', expires_at: '2026-01-01T12:00:00Z' };
  const long = { created_at: '2026-01-01T00:00:00Z', expires_at: '2026-01-31T00:00:00Z' };
  assert.equal(idleLimitMs({}, short), 30 * 60e3);
  assert.equal(idleLimitMs({ IDLE_MINUTES: '15' }, short), 15 * 60e3);
  assert.equal(idleLimitMs({ IDLE_MINUTES: 'abc' }, short), 30 * 60e3);
  assert.equal(idleLimitMs({}, long), 7 * 864e5);
});

test('turnstile: skipped without a secret, strict with one', async () => {
  assert.equal(await turnstileOk({}, '', '1.2.3.4'), true);
  assert.equal(await turnstileOk({ TURNSTILE_SECRET: 's' }, '', '1.2.3.4'), false);
  const ok = async () => new Response(JSON.stringify({ success: true }));
  const no = async () => new Response(JSON.stringify({ success: false }));
  const boom = async () => { throw new Error('down'); };
  assert.equal(await turnstileOk({ TURNSTILE_SECRET: 's' }, 'tok', '1.2.3.4', ok), true);
  assert.equal(await turnstileOk({ TURNSTILE_SECRET: 's' }, 'tok', '1.2.3.4', no), false);
  assert.equal(await turnstileOk({ TURNSTILE_SECRET: 's' }, 'tok', '1.2.3.4', boom), false);
});
