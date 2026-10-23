// Public, cacheable settings the website JS needs (never secrets).
export async function onRequestGet({ env }) {
  const body = { turnstile_site_key: env.TURNSTILE_SITE_KEY || '' };
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
  });
}
