// The /admin page is just an app shell (no data). Sign-in happens inside it;
// every data request is checked by functions/api/admin/_middleware.js.
// Security headers (CSP, no-store, noindex) are added once for /admin and /api in worker/index.js.
export async function onRequest(ctx) {
  return ctx.next();
}
