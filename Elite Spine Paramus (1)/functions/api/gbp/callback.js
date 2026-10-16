// Google redirects back here after the owner approves access.
import { getSetting, setSetting } from '../../_lib/automation.js';
import { audit } from '../../_lib/util.js';
import { googleToken, redirectUri, seal, listLocations } from '../../_lib/ai.js';

const back = (request, msg) => Response.redirect(new URL(request.url).origin + '/admin/#ai' + (msg ? '?gbp=' + encodeURIComponent(msg) : ''), 302);

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const st = await getSetting(env, 'gbp_oauth', null);
  if (url.searchParams.get('error')) return back(request, 'cancelled');
  if (!st || st.state !== url.searchParams.get('state') || st.exp < Date.now()) return back(request, 'expired');
  await setSetting(env, 'gbp_oauth', {}, 'system');
  try {
    const t = await googleToken(env, { grant_type: 'authorization_code', code: url.searchParams.get('code') || '', redirect_uri: redirectUri(request) });
    if (!t.refresh_token) return back(request, 'norefresh');
    const locs = await listLocations(t.access_token).catch(() => []);
    const one = locs.length === 1 ? locs[0] : null;
    await setSetting(env, 'gbp', {
      refresh: await seal(env, t.refresh_token), by: st.by, at: new Date().toISOString(),
      account: one && one.account, location: one && one.location, title: one && one.title, address: one && one.address,
      choices: one ? [] : locs.slice(0, 50)
    }, st.by);
    await audit(env, st.by, 'gbp.connect', one ? one.title : locs.length + ' locations');
    return back(request, one ? 'connected' : locs.length ? 'pick' : 'nolocations');
  } catch (e) { return back(request, 'failed'); }
}
