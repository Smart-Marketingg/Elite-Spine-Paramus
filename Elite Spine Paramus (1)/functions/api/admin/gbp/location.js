import { json, can, forbidden, audit } from '../../../_lib/util.js';
import { getSetting, setSetting } from '../../../_lib/automation.js';

// POST {location} picks which business to read. POST {disconnect:true} removes the connection.
export async function onRequestPost({ request, env, data }) {
  if (!can(data.user, 'ai', 'publish')) return forbidden();
  const b = await request.json().catch(() => ({}));
  const g = await getSetting(env, 'gbp', null);
  if (b.disconnect) {
    await setSetting(env, 'gbp', {}, data.user.email);
    await audit(env, data.user.email, 'gbp.disconnect', '');
    return json({ ok: true });
  }
  if (!g || !g.refresh) return json({ error: 'Connect Google first.' }, 400);
  const pick = (g.choices || []).find(c => c.location === b.location);
  if (!pick) return json({ error: 'Pick one of the listed locations.' }, 400);
  await setSetting(env, 'gbp', { ...g, account: pick.account, location: pick.location, title: pick.title, address: pick.address, choices: [] }, data.user.email);
  await audit(env, data.user.email, 'gbp.location', pick.title);
  return json({ ok: true });
}
