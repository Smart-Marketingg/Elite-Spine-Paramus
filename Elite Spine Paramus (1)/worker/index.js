// Elite Spine site Worker: serves the static site and runs the CRM backend.
// Routes mirror the old Pages Functions layout in /functions (handlers unchanged).
import * as mwApiAdmin from '../functions/api/admin/_middleware.js';
import * as mwAdmin from '../functions/admin/_middleware.js';

import * as lead from '../functions/api/lead.js';
import * as posts from '../functions/api/posts.js';
import * as authLogin from '../functions/api/auth/login.js';
import * as authLogout from '../functions/api/auth/logout.js';
import * as authForgot from '../functions/api/auth/forgot.js';
import * as authToken from '../functions/api/auth/token.js';
import * as authAccept from '../functions/api/auth/accept.js';
import * as cronWeekly from '../functions/api/cron/weekly.js';
import * as gbpCallback from '../functions/api/gbp/callback.js';
import * as media from '../functions/media/[[path]].js';

import * as me from '../functions/api/admin/me.js';
import * as password from '../functions/api/admin/password.js';
import * as invite from '../functions/api/admin/invite.js';
import * as leads from '../functions/api/admin/leads.js';
import * as leadsExport from '../functions/api/admin/leads/export.js';
import * as leadId from '../functions/api/admin/leads/[id].js';
import * as pipelines from '../functions/api/admin/pipelines.js';
import * as replies from '../functions/api/admin/autoreplies.js';
import * as repliesTest from '../functions/api/admin/autoreplies/test.js';
import * as replyId from '../functions/api/admin/autoreplies/[id].js';
import * as adminPosts from '../functions/api/admin/posts.js';
import * as postId from '../functions/api/admin/posts/[id].js';
import * as upload from '../functions/api/admin/upload.js';
import * as users from '../functions/api/admin/users.js';
import * as userEmail from '../functions/api/admin/users/[email].js';
import * as ai from '../functions/api/admin/ai.js';
import * as aiRun from '../functions/api/admin/ai/run.js';
import * as aiWrite from '../functions/api/admin/ai/write.js';
import * as aiReview from '../functions/api/admin/ai/review.js';
import * as gbpConnect from '../functions/api/admin/gbp/connect.js';
import * as gbpLocation from '../functions/api/admin/gbp/location.js';
import * as analytics from '../functions/api/admin/analytics.js';
import * as keys from '../functions/api/admin/keys.js';
import * as crm from '../functions/api/admin/crm.js';
import * as config from '../functions/api/config.js';
import * as health from '../functions/api/health.js';
import { crmState } from '../functions/_lib/util.js';
import { withKeys } from '../functions/_lib/keys.js';
import { applySecurityHeaders } from '../functions/_lib/headers.js';
import { retryFailedNotifications } from '../functions/_lib/notify.js';
import { pruneSessions } from '../functions/_lib/auth.js';

import { getAiSettings, runWeekly } from '../functions/_lib/ai.js';

// Static paths before dynamic ones within the same folder.
const ROUTES = [
  ['/api/lead', lead],
  ['/api/config', config],
  ['/api/health', health],
  ['/api/posts', posts],
  ['/api/auth/login', authLogin],
  ['/api/auth/logout', authLogout],
  ['/api/auth/forgot', authForgot],
  ['/api/auth/token', authToken],
  ['/api/auth/accept', authAccept],
  ['/api/cron/weekly', cronWeekly],
  ['/api/gbp/callback', gbpCallback],
  ['/api/admin/me', me],
  ['/api/admin/password', password],
  ['/api/admin/invite', invite],
  ['/api/admin/leads', leads],
  ['/api/admin/leads/export', leadsExport],
  ['/api/admin/leads/[id]', leadId],
  ['/api/admin/pipelines', pipelines],
  ['/api/admin/autoreplies', replies],
  ['/api/admin/autoreplies/test', repliesTest],
  ['/api/admin/autoreplies/[id]', replyId],
  ['/api/admin/posts', adminPosts],
  ['/api/admin/posts/[id]', postId],
  ['/api/admin/upload', upload],
  ['/api/admin/users', users],
  ['/api/admin/users/[email]', userEmail],
  ['/api/admin/ai', ai],
  ['/api/admin/ai/run', aiRun],
  ['/api/admin/ai/write', aiWrite],
  ['/api/admin/ai/review', aiReview],
  ['/api/admin/gbp/connect', gbpConnect],
  ['/api/admin/gbp/location', gbpLocation],
  ['/api/admin/analytics', analytics],
  ['/api/admin/keys', keys],
  ['/api/admin/crm', crm],
  ['/media/[[path]]', media]
].map(([pattern, mod]) => ({ parts: pattern.split('/').filter(Boolean), mod }));

function match(pathname) {
  const segs = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  for (const r of ROUTES) {
    const params = {};
    let ok = true;
    for (let i = 0; i < r.parts.length; i++) {
      const p = r.parts[i];
      const rest = /^\[\[(.+)\]\]$/.exec(p);
      if (rest) {
        if (i >= segs.length) { ok = false; break; }
        params[rest[1]] = segs.slice(i).map(decodeURIComponent);
        return { mod: r.mod, params };
      }
      const one = /^\[(.+)\]$/.exec(p);
      if (i >= segs.length) { ok = false; break; }
      if (one) params[one[1]] = decodeURIComponent(segs[i]);
      else if (p !== segs[i]) { ok = false; break; }
    }
    if (ok && segs.length === r.parts.length) return { mod: r.mod, params };
  }
  return null;
}

function pick(mod, method) {
  const m = method.charAt(0) + method.slice(1).toLowerCase();
  return mod['onRequest' + m] || mod.onRequest || (method === 'HEAD' ? mod.onRequestGet : null);
}

const jsonRes = (body, status) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Runs middleware → handler with the same context shape Pages Functions use.
function run(chain, request, env, ctx, params) {
  const data = {};
  let i = 0;
  const context = { request, env, params, data, waitUntil: (p) => ctx.waitUntil(p), passThroughOnException: () => {} };
  const next = async (input, init) => {
    if (input !== undefined) context.request = input instanceof Request && !init ? input : new Request(input, init);
    const fn = chain[i++];
    if (!fn) return env.ASSETS.fetch(context.request);
    return fn({ ...context, next });
  };
  return next();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    let res;
    try {
      if (path === '/admin' || path.startsWith('/admin/')) {
        res = await run([mwAdmin.onRequest], request, env, ctx, {});
      } else if (path.startsWith('/api/') || path.startsWith('/media/')) {
        const m = match(path);
        if (!m) res = jsonRes({ error: 'not found' }, 404);
        else {
          const handler = pick(m.mod, request.method);
          if (!handler) res = jsonRes({ error: 'method not allowed' }, 405);
          else {
            env = await withKeys(env);
            const chain = path.startsWith('/api/admin/') ? [mwApiAdmin.onRequest, handler] : [handler];
            res = await run(chain, request, env, ctx, m.params);
          }
        }
      } else {
        return env.ASSETS.fetch(request);
      }
    } catch (e) {
      console.error('request failed', path, e && e.stack || e);
      res = jsonRes({ error: 'Server error' }, 500);
    }
    return applySecurityHeaders(res, path, env);
  },

  // Cron triggers (wrangler.jsonc): every 15 min = retry failed lead notifications + prune
  // expired sessions; Monday 13:00 UTC = AI Writer weekly job.
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        env = await withKeys(env);
        if (event.cron !== '0 13 * * MON') {
          await pruneSessions(env);
          const r = await retryFailedNotifications(env);
          if (r.retried) console.log('notification retry', JSON.stringify(r));
          return;
        }
        if ((await crmState(env)).off) return console.log('weekly job: CRM is shut down');
        const s = await getAiSettings(env);
        if (!s.enabled) return console.log('weekly job: AI Writer paused');
        const r = await runWeekly(env, env.SITE_URL || 'https://www.elitespineparamus.com', 'weekly');
        console.log('weekly job', JSON.stringify({ checked: r.checked, created: r.created.length, error: r.error }));
      } catch (e) { console.error('scheduled job failed', event.cron, e && e.stack || e); }
    })());
  }
};
