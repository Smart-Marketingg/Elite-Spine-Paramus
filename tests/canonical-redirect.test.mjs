import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalRedirect } from '../Elite Spine Paramus (1)/worker/index.js';

const SITE = 'https://www.elitespineparamus.com';
const go = (u, init) => canonicalRedirect(new Request(u, init), SITE);

test('bare domain and http go to https://www. with one 301, keeping path and query', () => {
  for (const [from, to] of [
    ['http://elitespineparamus.com/team?a=1', 'https://www.elitespineparamus.com/team?a=1'],
    ['https://elitespineparamus.com/', 'https://www.elitespineparamus.com/'],
    ['http://www.elitespineparamus.com/blog', 'https://www.elitespineparamus.com/blog']
  ]) {
    const r = go(from);
    assert.equal(r.status, 301);
    assert.equal(r.headers.get('location'), to);
  }
});

test('canonical host, previews and non-GET requests are served as-is', () => {
  assert.equal(go('https://www.elitespineparamus.com/'), null);
  assert.equal(go('https://elite-spine-paramus.example.workers.dev/'), null);
  assert.equal(go('http://elitespineparamus.com/api/lead', { method: 'POST' }), null);
  assert.equal(canonicalRedirect(new Request('http://elitespineparamus.com/'), undefined), null);
});
