// Verifies the Cloudflare Access JWT on every admin request.
// Required env vars (Pages → Settings → Variables):
//   CF_ACCESS_TEAM_DOMAIN  e.g. elitespine.cloudflareaccess.com
//   CF_ACCESS_AUD          the Application Audience (AUD) tag from Zero Trust → Access → Applications
// Optional:
//   SUPER_ADMINS           comma-separated super-admin emails (default: jullien@smartmarketingg.com).
//                          Everyone else is managed in the portal's Users screen (D1 `users` table).

let jwks = null;
let jwksAt = 0;

function b64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function cookie(req, name) {
  const c = req.headers.get('Cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

async function keys(team) {
  if (!jwks || Date.now() - jwksAt > 3600_000) {
    const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
    if (!r.ok) throw new Error('certs fetch failed');
    jwks = (await r.json()).keys || [];
    jwksAt = Date.now();
  }
  return jwks;
}

export async function verifyAccess(request, env) {
  const team = env.CF_ACCESS_TEAM_DOMAIN;
  const aud = env.CF_ACCESS_AUD;
  if (!team || !aud) return null; // fail closed when not configured
  const token = request.headers.get('Cf-Access-Jwt-Assertion') || cookie(request, 'CF_Authorization');
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const dec = new TextDecoder();
    const header = JSON.parse(dec.decode(b64url(parts[0])));
    const payload = JSON.parse(dec.decode(b64url(parts[1])));
    let jwk = (await keys(team)).find(k => k.kid === header.kid);
    if (!jwk) { jwks = null; jwk = (await keys(team)).find(k => k.kid === header.kid); }
    if (!jwk || header.alg !== 'RS256') return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!ok) return null;
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(aud)) return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    if (payload.nbf && payload.nbf > now + 60) return null;
    if (payload.iss && payload.iss !== `https://${team}`) return null;
    return { email: (payload.email || '').toLowerCase() };
  } catch (_) {
    return null;
  }
}
