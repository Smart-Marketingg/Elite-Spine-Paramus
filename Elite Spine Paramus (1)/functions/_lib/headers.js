// Security headers added by the Worker. The static _headers file does not apply to
// responses the Worker produces, so /admin and /api get their policy here.

export const isPrivatePath = (p) => p === '/admin' || p.startsWith('/admin/') || p.startsWith('/api/');

export function adminCsp(env = {}) {
  const media = String(env.MEDIA_URL || '').replace(/\/$/, '');
  return [
    "default-src 'self'",
    "script-src 'self'",
    // The portal builds inline style="" attributes (pills, colours, editor), so styles stay 'unsafe-inline'.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    `img-src 'self' data: blob: https:${media ? ' ' + media : ''}`,
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join('; ');
}

export function applySecurityHeaders(response, pathname, env = {}) {
  const h = new Headers(response.headers);
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  h.set('X-Content-Type-Options', 'nosniff');
  if (!h.has('X-Frame-Options')) h.set('X-Frame-Options', 'SAMEORIGIN');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  if (!h.has('Referrer-Policy')) h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isPrivatePath(pathname)) {
    h.set('X-Robots-Tag', 'noindex, nofollow');
    h.set('Cache-Control', 'no-store');
    h.set('Referrer-Policy', 'no-referrer');
    h.set('X-Frame-Options', 'DENY');
    h.set('Content-Security-Policy', adminCsp(env));
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}

// CSRF: state-changing calls must come from our own pages. The portal sends
// X-Requested-With: crm on every write; browsers never add that header cross-site
// without a CORS preflight, which /api never answers.
export function csrfOk(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return false;
  const xrw = (request.headers.get('X-Requested-With') || '').toLowerCase();
  if (xrw === 'crm') return true;
  // Non-JS fallbacks (plain form posts) must at least carry a matching Origin or Referer.
  if (origin) return true;
  const ref = request.headers.get('Referer');
  try { return !!ref && new URL(ref).origin === new URL(request.url).origin; } catch (_) { return false; }
}
