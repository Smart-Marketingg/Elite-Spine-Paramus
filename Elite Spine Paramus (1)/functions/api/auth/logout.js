import { json } from '../../_lib/util.js';
import { endSession, clearCookie, sameOrigin } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'bad origin' }, 403);
  await endSession(env, request).catch(() => {});
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie });
}
