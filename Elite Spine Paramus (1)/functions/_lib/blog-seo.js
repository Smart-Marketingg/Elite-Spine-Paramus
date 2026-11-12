// Server-side blog output so search engines see portal posts without running JS.
// robots.txt blocks /api/, so Googlebot can't load /api/posts when it renders the page:
// the Worker puts posts into sitemap.xml, the post page and the blog grids itself.

const LIVE = `status = 'published' AND (publish_at IS NULL OR publish_at <= strftime('%Y-%m-%dT%H:%M:%SZ','now'))`;

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const postUrl = (site, slug) => `${site}/blog-post?post=${encodeURIComponent(slug)}`;

export async function livePosts(env) {
  if (!env.DB) return [];
  const r = await env.DB.prepare(`SELECT slug, title, excerpt, category, hero, publish_at, LENGTH(body_html) AS len FROM posts WHERE ${LIVE} ORDER BY publish_at DESC LIMIT 50`).all();
  return r.results || [];
}

export async function livePost(env, slug) {
  if (!env.DB || !slug) return null;
  return env.DB.prepare(`SELECT slug, title, excerpt, body_html, category, hero, seo_title, seo_description, publish_at FROM posts WHERE slug = ? AND ${LIVE}`).bind(slug).first();
}

// Built-in articles live in blog-posts.js as `  "slug": {` keys.
export const builtInSlugs = (js) => [...String(js).matchAll(/^ {2}"([a-z0-9-]+)": \{/gm)].map((m) => m[1]);

// Adds one <url> per post before </urlset>, skipping any loc the static file already lists.
export function mergeSitemap(xml, site, posts, builtIns) {
  const seen = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&')));
  const rows = [];
  const add = (slug, date) => {
    const loc = postUrl(site, slug);
    if (seen.has(loc)) return;
    seen.add(loc);
    const mod = date && !isNaN(new Date(date)) ? `\n    <lastmod>${new Date(date).toISOString().slice(0, 10)}</lastmod>` : '';
    rows.push(`  <url>\n    <loc>${esc(loc)}</loc>${mod}\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`);
  };
  posts.forEach((p) => add(p.slug, p.publish_at));
  builtIns.forEach((s) => add(s));
  return rows.length ? xml.replace('</urlset>', rows.join('\n') + '\n</urlset>') : xml;
}

// Same markup blog-live.js builds, so the script sees these cards and doesn't add them twice.
export function cardHtml(p) {
  const mins = Math.max(1, Math.round((p.len || 0) / 1300)) + ' min read';
  return `<a class="bcard" href="blog-post?post=${esc(encodeURIComponent(p.slug))}">` +
    `<div class="bcard__img"><img loading="lazy" src="${esc(p.hero || 'images/clinic-opt.jpg')}" alt="${esc(p.title)}" /></div>` +
    `<div class="bcard__body"><div class="bcard__meta"><span>${esc(p.category || 'Wellness')}</span><span class="dot"></span><span>${mins}</span></div>` +
    `<h3>${esc(p.title)}</h3><p>${esc(p.excerpt || '')}</p>` +
    `<span class="bcard__more">Read More<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg></span>` +
    `</div></a>`;
}

const readTime = (html) => Math.max(1, Math.round(String(html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 220)) + ' min read';
const longDate = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }); };

// BlogPosting + breadcrumb JSON-LD, mirroring what blog-post.js used to add in the browser.
export function postSchema(site, post) {
  const url = postUrl(site, post.slug);
  const hero = /^https?:/.test(post.hero || '') ? post.hero : `${site}/${String(post.hero || 'images/og-image.jpg').replace(/^\//, '')}`;
  const art = { '@type': 'BlogPosting', '@id': url, mainEntityOfPage: url, url, headline: post.title, description: post.seo_description || post.excerpt || '', image: hero, articleSection: post.category,
    author: { '@type': 'Organization', name: 'Elite Spine & Sports Care of Paramus', url: site + '/' }, publisher: { '@id': site + '/#clinic' } };
  const d = new Date(post.publish_at);
  if (!isNaN(d)) art.datePublished = d.toISOString();
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': [art, { '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: site + '/' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: site + '/blog' },
    { '@type': 'ListItem', position: 3, name: post.title, item: url }] },
  { '@type': 'MedicalClinic', '@id': site + '/#clinic', name: 'Elite Spine & Sports Care of Paramus', url: site + '/', telephone: '+1-201-483-6653', logo: site + '/images/logo.svg',
    address: { '@type': 'PostalAddress', streetAddress: '37 W Century Rd', addressLocality: 'Paramus', addressRegion: 'NJ', postalCode: '07652', addressCountry: 'US' } }] }).replace(/</g, '\\u003c');
}

export function renderPost(res, site, post) {
  const url = postUrl(site, post.slug);
  const title = post.seo_title || post.title;
  const desc = post.seo_description || post.excerpt || '';
  const hero = post.hero || 'images/clinic-opt.jpg';
  const attr = (name, value) => ({ element: (el) => { if (value) el.setAttribute(name, value); } });
  const text = (value) => ({ element: (el) => el.setInnerContent(value || '') });
  return new HTMLRewriter()
    // A portal SEO title is used as written; otherwise the post title gets the site suffix.
    .on('title', text(post.seo_title || `${post.title} — Elite Spine & Sports Care | Paramus, NJ`))
    .on('meta[name="description"]', attr('content', desc))
    .on('link[rel="canonical"]', attr('href', url))
    .on('meta[property="og:url"]', attr('content', url))
    .on('meta[property="og:type"]', attr('content', 'article'))
    .on('meta[property="og:title"]', attr('content', title))
    .on('meta[name="twitter:title"]', attr('content', title))
    .on('meta[property="og:description"]', attr('content', desc))
    .on('meta[name="twitter:description"]', attr('content', desc))
    .on('head', { element: (el) => el.append(`<script type="application/ld+json" data-ssr-ld>${postSchema(site, post)}</script>`, { html: true }) })
    .on('#artHeroImg', { element: (el) => { el.setAttribute('src', hero); el.setAttribute('alt', post.title); } })
    .on('#artTag', text(post.category))
    .on('#artCrumb', text(post.category))
    .on('#artDate', text(longDate(post.publish_at)))
    .on('#artRead', text(readTime(post.body_html)))
    .on('#artTitle', text(post.title))
    // body_html is sanitized when it is saved in the portal.
    .on('#artBody', { element: (el) => el.setInnerContent(post.body_html || '', { html: true }) })
    .transform(res);
}

// Puts live posts at the top of each .blog-grid; a data-limit grid (home page) keeps that many cards in total.
export function renderGrid(res, posts) {
  if (!posts.length) return res;
  let limit = 0, shown = 0;
  return new HTMLRewriter()
    .on('.blog-grid', { element: (el) => {
      limit = parseInt(el.getAttribute('data-limit'), 10) || 0;
      const fresh = limit ? posts.slice(0, limit) : posts;
      shown = fresh.length;
      el.prepend(fresh.map(cardHtml).join(''), { html: true });
    } })
    .on('.blog-grid > a.bcard', { element: (el) => { if (limit && ++shown > limit) el.remove(); } })
    .transform(res);
}
