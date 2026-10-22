// Clinic identity and notification settings, read from wrangler.jsonc vars.
// Every hard-coded phone/address/email used to live in several files; this is the one place now.

const DEFAULTS = {
  name: 'Elite Spine & Sports Care',
  phone: '(201) 483-6653',
  address: '37 W Century Rd, Paramus, NJ 07652',
  booking: 'https://www.zocdoc.com/practice/elite-spine-and-sports-care-60454',
  email: 'elitespineparamus@gmail.com',
  site: 'https://www.elitespineparamus.com',
  color: '#ff6a1a'
};

export function clinic(env = {}) {
  const site = String(env.SITE_URL || DEFAULTS.site).replace(/\/$/, '');
  const replyTo = env.MAIL_REPLY_TO || DEFAULTS.email;
  return {
    name: env.BUSINESS_NAME || DEFAULTS.name,
    phone: env.BUSINESS_PHONE || DEFAULTS.phone,
    address: env.BUSINESS_ADDRESS || DEFAULTS.address,
    booking: env.BOOKING_URL || DEFAULTS.booking,
    email: replyTo,
    site,
    color: env.BRAND_COLOR || DEFAULTS.color,
    logo: env.LOGO_URL || site + '/images/logo.svg',
    tz: env.TIMEZONE || 'America/New_York',
    from: env.MAIL_FROM || `${env.BUSINESS_NAME || DEFAULTS.name} <hello@elitespineparamus.com>`
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const splitEmails = (s) => String(s || '').split(/[,\s;]+/).map(x => x.trim().toLowerCase()).filter(x => EMAIL_RE.test(x));

// Who gets the "new lead" email for a given form: NOTIFY_ROUTES {"Form name": "a@x, b@y"} wins, else NOTIFY_EMAILS.
export function notifyRecipients(env = {}, form) {
  let routes = {};
  try { routes = JSON.parse(env.NOTIFY_ROUTES || '{}') || {}; } catch (_) { routes = {}; }
  const key = Object.keys(routes).find(k => k.toLowerCase() === String(form || '').toLowerCase());
  const list = key ? splitEmails(routes[key]) : [];
  return [...new Set(list.length ? list : splitEmails(env.NOTIFY_EMAILS))];
}

// What the portal shows on its health strip (never the secret values themselves).
export function integrations(env = {}) {
  return {
    resend: !!env.RESEND_API_KEY,
    turnstile: !!env.TURNSTILE_SECRET && !!env.TURNSTILE_SITE_KEY,
    notify: notifyRecipients(env),
    ga4: !!env.GA_SERVICE_ACCOUNT && !!env.GA4_PROPERTY_ID,
    anthropic: !!env.ANTHROPIC_API_KEY,
    google: !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET
  };
}
