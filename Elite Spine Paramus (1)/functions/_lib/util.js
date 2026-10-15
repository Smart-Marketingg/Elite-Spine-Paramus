export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }
  });
}

export const LEAD_STATUSES = ['new', 'contacted', 'booked', 'closed'];

// ---------- users & permissions ----------
// leads: none < view < manage     (manage = change status, delete, export)
// blog:  none < write < publish   (write = drafts only; publish = go live, edit live posts, delete)
// users: 0/1                      (add/remove people and set their access)
// setup: 0/1                      (edit pipelines + auto-replies)
// source: 0/1                     (see where leads came from; only super admins can change it)
export const LEVELS = { leads: ['none', 'view', 'manage'], blog: ['none', 'write', 'publish'] };
const SUPER_DEFAULT = 'jullien@smartmarketingg.com';

// Sidebar sections a super admin can switch off per person (users.off, JSON array).
// Hidden sections disappear from that person's portal AND their API calls are refused (see sectionFor).
export const SECTIONS = ['leads', 'analytics', 'blog', 'ai', 'pipelines', 'replies', 'users'];
export function parseOff(v) {
  let a = v;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch (_) { a = []; } }
  return Array.isArray(a) ? [...new Set(a.filter(x => SECTIONS.includes(x)))] : [];
}
// Which sidebar section an admin API request belongs to (null = always allowed, e.g. /me, /password).
export function sectionFor(path, method) {
  const p = path.replace(/\/+$/, '');
  if (p === '/api/admin/leads' || p.startsWith('/api/admin/leads/')) return 'leads';
  if (p === '/api/admin/analytics') return 'analytics';
  if (p === '/api/admin/posts' || p.startsWith('/api/admin/posts/') || p === '/api/admin/upload') return 'blog';
  if (p === '/api/admin/ai' || p.startsWith('/api/admin/ai/') || p.startsWith('/api/admin/gbp/')) return 'ai';
  // Reading pipelines is also needed by the Auto-replies screen; only changes count as "Pipelines".
  if (p === '/api/admin/pipelines') return method === 'GET' ? null : 'pipelines';
  if (p === '/api/admin/autoreplies' || p.startsWith('/api/admin/autoreplies/')) return 'replies';
  if (p === '/api/admin/users' || p.startsWith('/api/admin/users/') || p === '/api/admin/invite') return 'users';
  return null;
}

export function superAdmins(env) {
  return String(env.SUPER_ADMINS || SUPER_DEFAULT).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

export async function loadUser(env, email) {
  email = String(email || '').toLowerCase();
  if (!email) return null;
  if (superAdmins(env).includes(email)) {
    return { email, name: 'Super admin', super: true, leads: 'manage', blog: 'publish', users: true, setup: true, source: true, off: [] };
  }
  const u = await env.DB.prepare('SELECT email, name, leads, blog, users, setup, source, off FROM users WHERE email = ? AND active = 1').bind(email).first();
  if (!u) return null;
  env.DB.prepare(`UPDATE users SET last_seen = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE email = ?`).bind(email).run().catch(() => {});
  return { email: u.email, name: u.name, super: false, leads: u.leads, blog: u.blog, users: !!u.users, setup: !!u.setup, source: !!u.source, off: parseOff(u.off) };
}

export function can(user, area, level) {
  if (!user) return false;
  if (area === 'users') return !!user.users;
  if (area === 'setup') return !!user.setup;
  if (area === 'source') return !!user.source;
  const order = LEVELS[area];
  return order.indexOf(user[area]) >= order.indexOf(level);
}

export const forbidden = (msg) => json({ error: msg || 'You don’t have access to do that.' }, 403);

// ---------- lead source (UTM / click IDs / referrer) ----------
export const ATTR_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'referrer', 'landing_page', 'first_touch', 'first_seen'];
export const CHANNELS = ['Google Ads', 'Microsoft Ads', 'Meta Ads', 'Other Paid', 'Google Business Profile', 'Organic Search', 'Social', 'Email', 'Referral', 'Direct'];

export function classifyChannel(a) {
  const src = String(a.utm_source || '').toLowerCase();
  const med = String(a.utm_medium || '').toLowerCase();
  const camp = String(a.utm_campaign || '').toLowerCase();
  const paid = /(^|[^a-z])(cpc|ppc|paid|cpm|cpv|display|ads?)([^a-z]|$)|paid/.test(med);
  let host = '';
  try { host = a.referrer ? new URL(a.referrer).hostname.replace(/^www\./, '').toLowerCase() : ''; } catch (_) {}
  if (a.gclid || a.gbraid || a.wbraid || (/google/.test(src) && paid)) return 'Google Ads';
  if (a.msclkid || (/bing|microsoft/.test(src) && paid)) return 'Microsoft Ads';
  if (/facebook|^fb$|instagram|^ig$|meta/.test(src) && paid) return 'Meta Ads';
  if (/gbp|gmb|business|maps/.test(med + ' ' + src + ' ' + camp)) return 'Google Business Profile';
  if (paid) return 'Other Paid';
  if (/e-?mail|newsletter/.test(med) || /mailchimp|klaviyo|newsletter/.test(src)) return 'Email';
  if (/social/.test(med) || /facebook|^fb$|instagram|^ig$|tiktok|linkedin|twitter|^x$|youtube|pinterest|nextdoor/.test(src) || a.fbclid) return 'Social';
  if (med === 'organic' || /^(google|bing|yahoo|duckduckgo)$/.test(src)) return 'Organic Search';
  if (src) return 'Referral';
  if (/(^|\.)google\.|bing\.com|yahoo\.|duckduckgo\.|ecosia\.|search\.brave/.test(host)) return 'Organic Search';
  if (/facebook\.com|instagram\.com|t\.co$|twitter\.com|x\.com|linkedin\.com|tiktok\.com|youtube\.com|pinterest\.|nextdoor\.com|lnkd\.in/.test(host)) return 'Social';
  if (/mail\.|outlook\./.test(host)) return 'Email';
  if (host) return 'Referral';
  return 'Direct';
}

export function clip(v, n = 2000) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, n) : null;
}

export async function audit(env, actor, action, target) {
  try {
    await env.DB.prepare('INSERT INTO audit (actor, action, target) VALUES (?, ?, ?)')
      .bind(actor || null, action, String(target ?? '')).run();
  } catch (_) { /* audit is best-effort */ }
}

export function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}

// Allow-list sanitizer for admin-authored post HTML (runs on save).
const ALLOWED = new Set(['p','h2','h3','h4','strong','b','em','i','u','a','ul','ol','li','blockquote','br','img','figure','figcaption','hr']);
export function sanitizeHtml(html) {
  let out = String(html || '');
  out = out.replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|svg|math)[\s\S]*?<\/\1>/gi, '');
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (m, tag, attrs) => {
    const t = tag.toLowerCase();
    if (!ALLOWED.has(t)) return '';
    if (m.startsWith('</')) return `</${t}>`;
    const keep = [];
    const re = /([a-z-]+)\s*=\s*("([^"]*)"|'([^']*)')/gi;
    let a;
    while ((a = re.exec(attrs))) {
      const name = a[1].toLowerCase();
      const val = (a[3] ?? a[4] ?? '').replace(/"/g, '&quot;');
      if (t === 'a' && name === 'href' && /^(https?:|mailto:|tel:|\/|#)/i.test(val)) keep.push(`href="${val}"`);
      if (t === 'img' && name === 'src' && /^(https?:|\/media\/|\/images\/|images\/)/i.test(val)) keep.push(`src="${val}"`);
      if (t === 'img' && name === 'alt') keep.push(`alt="${val}"`);
    }
    if (t === 'a' && keep.some(k => /href="https?:/i.test(k))) keep.push('target="_blank"', 'rel="noopener"');
    if (t === 'img') keep.push('loading="lazy"');
    return `<${t}${keep.length ? ' ' + keep.join(' ') : ''}>`;
  });
  return out.slice(0, 200000);
}
