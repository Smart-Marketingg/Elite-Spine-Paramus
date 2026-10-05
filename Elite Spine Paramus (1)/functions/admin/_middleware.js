// The /admin page is just an app shell (no data). Sign-in happens inside it;
// every data request is checked by functions/api/admin/_middleware.js.
export async function onRequest(ctx) {
  const res = await ctx.next();
  const out = new Response(res.body, res);
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  out.headers.set('Cache-Control', 'no-store');
  out.headers.set('X-Frame-Options', 'DENY');
  out.headers.set('Referrer-Policy', 'no-referrer');
  return out;
}
