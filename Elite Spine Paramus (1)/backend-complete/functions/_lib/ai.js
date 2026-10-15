// AI blog writer: Google Business Profile posts → Claude → blog drafts (or auto-publish).
import { slugify, sanitizeHtml, clip, audit } from './util.js';
import { getSetting, setSetting, sendEmail } from './automation.js';

export const AI_DEFAULTS = {
  enabled: true,            // weekly job runs
  autoPublish: false,       // false = drafts wait for approval
  words: 700,
  category: 'Wellness',
  voice: 'Warm, confident and plain-spoken, like a trusted sports medicine clinician. Short paragraphs. No hype.',
  notify: 'elitespineparamus@gmail.com',
  maxPerRun: 3
};
export const getAiSettings = async (env) => ({ ...AI_DEFAULTS, ...(await getSetting(env, 'ai_blog', {})) });

// ---------- small AES-GCM wrapper for the Google refresh token ----------
async function key(env) {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('es-gbp:' + (env.GOOGLE_CLIENT_SECRET || '')));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export async function seal(env, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(env), new TextEncoder().encode(text)));
  return b64(iv) + '.' + b64(ct);
}
export async function unseal(env, packed) {
  const [iv, ct] = String(packed || '').split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await key(env), unb64(ct));
  return new TextDecoder().decode(pt);
}

// ---------- Google Business Profile ----------
export const GBP_SCOPE = 'https://www.googleapis.com/auth/business.manage';
export const redirectUri = (request) => new URL(request.url).origin + '/api/gbp/callback';

export async function googleToken(env, body) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...body })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Google sign-in failed: ' + (d.error_description || d.error || r.status));
  return d;
}
async function accessToken(env) {
  const g = await getSetting(env, 'gbp', null);
  if (!g || !g.refresh) throw new Error('Google Business Profile isn’t connected.');
  const t = await googleToken(env, { grant_type: 'refresh_token', refresh_token: await unseal(env, g.refresh) });
  return { token: t.access_token, gbp: g };
}
export async function gapi(token, url) {
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.error && d.error.message) || 'Google API error ' + r.status);
  return d;
}
export async function listLocations(token) {
  const acc = await gapi(token, 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts');
  const out = [];
  for (const a of (acc.accounts || []).slice(0, 10)) {
    const l = await gapi(token, `https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?readMask=name,title,storefrontAddress&pageSize=100`).catch(() => ({}));
    for (const x of (l.locations || [])) {
      const addr = x.storefrontAddress ? [(x.storefrontAddress.addressLines || [])[0], x.storefrontAddress.locality].filter(Boolean).join(', ') : '';
      out.push({ account: a.name, location: x.name, title: x.title, address: addr });
    }
  }
  return out;
}
async function fetchGbpPosts(env) {
  const { token, gbp } = await accessToken(env);
  if (!gbp.account || !gbp.location) throw new Error('Pick which business location to read in the AI Writer screen.');
  const locId = gbp.location.split('/').pop();
  const d = await gapi(token, `https://mybusiness.googleapis.com/v4/${gbp.account}/locations/${locId}/localPosts?pageSize=20`);
  return (d.localPosts || []).filter(p => p.state !== 'REJECTED' && p.summary).map(p => ({
    name: p.name, summary: clip(p.summary, 1500), type: p.topicType || 'STANDARD',
    created: p.createTime || null, url: p.searchUrl || null,
    media: (p.media || []).map(m => m.googleUrl || m.sourceUrl).filter(Boolean)[0] || null,
    cta: p.callToAction ? p.callToAction.actionType : null,
    event: p.event && p.event.title ? p.event.title : null, offer: p.offer && p.offer.couponCode ? p.offer.couponCode : null
  }));
}

// ---------- Claude ----------
const CLINIC = `Elite Spine & Sports Care, 37 W Century Rd, Paramus, NJ 07652. Phone (201) 483-6653. Book online: https://www.zocdoc.com/practice/elite-spine-and-sports-care-60454.
Services: physical therapy, chiropractic care, sports injury rehab, shockwave therapy, dry needling, Active Release Technique, deep tissue laser, Graston, massage, therapeutic taping, pre/post-op rehab, pre/post-natal care, vein screening, testosterone replacement therapy, peptide therapy.
Serves Paramus, Ridgewood, Fair Lawn, Oradell, River Edge, Hackensack, Rochelle Park and Bergen County.`;

const TOOL = {
  name: 'save_blog_post',
  description: 'Save the finished blog post.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Under 65 characters. Specific, not clickbait.' },
      excerpt: { type: 'string', description: '1–2 sentences, under 200 characters.' },
      body_html: { type: 'string', description: 'Article body using only <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <blockquote>. No <h1>, no images, no inline styles.' },
      category: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' }, maxItems: 6 },
      seo_title: { type: 'string', description: 'Under 60 characters.' },
      seo_description: { type: 'string', description: '140–160 characters.' }
    },
    required: ['title', 'excerpt', 'body_html', 'category', 'tags', 'seo_title', 'seo_description']
  }
};

export async function claudeWrite(env, s, source) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('Claude isn’t connected (ANTHROPIC_API_KEY missing).');
  const system = `You write blog posts for a physical therapy and chiropractic clinic website.
${CLINIC}
Voice: ${s.voice}
Rules:
- Write an original article of about ${s.words} words that expands on the source. Do not copy its sentences.
- Educational and accurate. No guarantees, cure claims, or specific medical advice; encourage an evaluation instead.
- Never invent patient stories, names, statistics, prices, or promotions that aren't in the source.
- Mention Paramus or Bergen County naturally once or twice. No keyword stuffing.
- End with a short paragraph inviting readers to book (link to the booking URL) or call.
- If the source is an offer or event, keep its details exactly as given and say they're subject to the clinic's terms.`;
  const user = source.kind === 'gbp'
    ? `Here is a new post from the clinic's Google Business Profile${source.created ? ' (posted ' + source.created.slice(0, 10) + ')' : ''}. Turn it into a full blog article.\n\nType: ${source.type}${source.event ? '\nEvent: ' + source.event : ''}${source.offer ? '\nOffer code: ' + source.offer : ''}\n\n"""${source.text}"""`
    : `Write a blog article based on this note or post from the clinic:\n\n"""${source.text}"""`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || 'claude-sonnet-4-5', max_tokens: 4096, system,
      tools: [TOOL], tool_choice: { type: 'tool', name: 'save_blog_post' },
      messages: [{ role: 'user', content: user }]
    })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Claude error: ' + ((d.error && d.error.message) || r.status));
  const out = (d.content || []).find(c => c.type === 'tool_use');
  if (!out || !out.input || !out.input.title || !out.input.body_html) throw new Error('Claude didn’t return a post. Try again.');
  return out.input;
}

async function uniqueSlug(env, base) {
  let slug = slugify(base) || 'post';
  for (let i = 2; i < 50; i++) {
    const hit = await env.DB.prepare('SELECT 1 FROM posts WHERE slug = ?').bind(slug).first();
    if (!hit) return slug;
    slug = slugify(base).slice(0, 80) + '-' + i;
  }
  return slugify(base) + '-' + Date.now();
}

// Copy a Google image into our own storage so it doesn't expire.
async function keepImage(env, url) {
  if (!url || !env.MEDIA) return url || null;
  try {
    const r = await fetch(url);
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !/^image\//.test(type)) return null;
    const key = 'ai/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + (type.includes('png') ? '.png' : type.includes('webp') ? '.webp' : '.jpg');
    await env.MEDIA.put(key, r.body, { httpMetadata: { contentType: type } });
    return '/media/' + key;
  } catch (_) { return null; }
}

export async function savePost(env, s, draft, source, by) {
  const publish = s.autoPublish;
  const slug = await uniqueSlug(env, draft.title);
  const hero = await keepImage(env, source.media);
  const r = await env.DB.prepare(
    `INSERT INTO posts (slug, title, excerpt, body_html, category, tags, hero, seo_title, seo_description, status, publish_at, author, origin, origin_ref, review, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai', ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))`
  ).bind(slug, clip(draft.title, 200), clip(draft.excerpt, 400), sanitizeHtml(draft.body_html), clip(draft.category || s.category, 60),
    (draft.tags || []).map(t => clip(t, 40)).filter(Boolean).slice(0, 6).join(','), hero,
    clip(draft.seo_title, 70), clip(draft.seo_description, 170),
    publish ? 'published' : 'draft', publish ? new Date().toISOString() : null, by || 'Claude',
    source.ref || null, publish ? 'auto' : 'pending').run();
  await audit(env, by || 'claude', publish ? 'ai.post.published' : 'ai.post.drafted', slug);
  return { id: r.meta.last_row_id, slug, title: draft.title, published: publish };
}

// Weekly job (also "Check now"): read new Google posts and turn each into a blog post.
export async function runWeekly(env, origin, by) {
  const s = await getAiSettings(env);
  const result = { checked: 0, created: [], skipped: 0, error: null };
  try {
    const posts = await fetchGbpPosts(env);
    result.checked = posts.length;
    for (const p of posts) {
      if (result.created.length >= s.maxPerRun) break;
      const seen = await env.DB.prepare('SELECT 1 FROM gbp_posts WHERE name = ?').bind(p.name).first();
      if (seen) { result.skipped++; continue; }
      await env.DB.prepare('INSERT INTO gbp_posts (name, summary, media, created, url, status) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(p.name, p.summary, p.media, p.created, p.url, 'processing').run();
      try {
        const draft = await claudeWrite(env, s, { kind: 'gbp', text: p.summary, type: p.type, created: p.created, event: p.event, offer: p.offer });
        const saved = await savePost(env, s, draft, { media: p.media, ref: p.name }, by);
        await env.DB.prepare(`UPDATE gbp_posts SET status = 'done', post_id = ? WHERE name = ?`).bind(saved.id, p.name).run();
        result.created.push(saved);
      } catch (e) {
        await env.DB.prepare(`UPDATE gbp_posts SET status = 'failed', error = ? WHERE name = ?`).bind(clip(e.message, 300), p.name).run();
        result.error = e.message;
      }
    }
  } catch (e) { result.error = e.message; }
  await setSetting(env, 'ai_last_run', { at: new Date().toISOString(), ...result, created: result.created.length }, by || 'cron');
  if (result.created.length && s.notify) {
    const list = result.created.map(c => `• ${c.title}${c.published ? ' (published)' : ''}`).join('\n');
    await sendEmail(env, {
      to: s.notify,
      subject: s.autoPublish ? `Claude published ${result.created.length} new blog post${result.created.length > 1 ? 's' : ''}` : `${result.created.length} new blog post${result.created.length > 1 ? 's' : ''} waiting for your approval`,
      text: `Claude turned your latest Google Business Profile posts into blog articles:\n\n${list}\n\n${s.autoPublish ? 'They’re live on the blog now.' : 'Review and approve them here:'}\n${origin}/admin/#ai\n\nElite Spine team portal`
    }).catch(() => {});
  }
  return result;
}
