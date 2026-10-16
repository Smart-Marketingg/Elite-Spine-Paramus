// Start "Connect Google": returns the Google consent URL.
import { json, can, forbidden } from '../../../_lib/util.js';
import { setSetting } from '../../../_lib/automation.js';
import { randomToken } from '../../../_lib/auth.js';
import { GBP_SCOPE, redirectUri } from '../../../_lib/ai.js';

export async function onRequestPost({ request, env, data }) {
  if (!can(data.user, 'blog', 'publish')) return forbidden();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return json({ error: 'Google isn’t set up yet. A super admin can add the Client ID and Secret in AI Writer → Google Business Profile → Set up.' }, 400);
  const state = randomToken(24);
  await setSetting(env, 'gbp_oauth', { state, by: data.user.email, exp: Date.now() + 10 * 60e3 }, data.user.email);
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(request), response_type: 'code',
    scope: GBP_SCOPE, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state
  });
  return json({ url });
}
