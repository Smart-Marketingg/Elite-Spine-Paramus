import test from 'node:test';
import assert from 'node:assert/strict';
import { builtInSlugs, mergeSitemap, cardHtml, postSchema, postUrl } from '../Elite Spine Paramus (1)/functions/_lib/blog-seo.js';

const SITE = 'https://www.elitespineparamus.com';
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.elitespineparamus.com/blog</loc>
  </url>
</urlset>
`;

test('built-in article slugs are read from blog-posts.js keys', () => {
  const js = 'window.BLOG_POSTS = {\n\n  "pt-vs-ot": {\n    title: "x",\n    body: [{ "h2": "y" }]\n  },\n\n  "nfl-injuries": {\n  }\n};';
  assert.deepEqual(builtInSlugs(js), ['pt-vs-ot', 'nfl-injuries']);
});

test('sitemap gains one canonical URL per post, with lastmod for portal posts', () => {
  const out = mergeSitemap(XML, SITE, [{ slug: 'dry-needling-paramus-nj', publish_at: '2026-10-19T12:00:00.000Z' }], ['pt-vs-ot']);
  assert.match(out, /<loc>https:\/\/www\.elitespineparamus\.com\/blog-post\?post=dry-needling-paramus-nj<\/loc>\n    <lastmod>2026-10-19<\/lastmod>/);
  assert.match(out, /<loc>https:\/\/www\.elitespineparamus\.com\/blog-post\?post=pt-vs-ot<\/loc>\n    <changefreq>/);
  assert.ok(out.trimEnd().endsWith('</urlset>'));
  assert.equal(out.match(/<url>/g).length, 3);
});

test('sitemap skips URLs that are already listed and duplicate slugs', () => {
  const listed = XML.replace('</urlset>', `  <url><loc>${postUrl(SITE, 'pt-vs-ot')}</loc></url>\n</urlset>`);
  const out = mergeSitemap(listed, SITE, [{ slug: 'pt-vs-ot' }], ['pt-vs-ot']);
  assert.equal(out, listed);
});

test('cards link to the canonical post URL and escape post text', () => {
  const html = cardHtml({ slug: 'a b', title: 'Neck <Pain> & "You"', excerpt: "It's fine", category: 'Chiropractic Care', len: 2600 });
  assert.match(html, /href="blog-post\?post=a%20b"/);
  assert.match(html, /<h3>Neck &lt;Pain&gt; &amp; &quot;You&quot;<\/h3>/);
  assert.match(html, /It&#39;s fine/);
  assert.match(html, /2 min read/);
});

test('post schema is BlogPosting with the canonical URL and cannot close the script tag', () => {
  const s = JSON.parse(postSchema(SITE, { slug: 'x', title: '</script><b>', excerpt: 'e', category: 'c', hero: 'images/h.jpg', publish_at: '2026-11-07T02:22:48.976Z' }));
  const art = s['@graph'][0];
  assert.equal(art['@type'], 'BlogPosting');
  assert.equal(art.url, `${SITE}/blog-post?post=x`);
  assert.equal(art.image, `${SITE}/images/h.jpg`);
  assert.equal(art.datePublished, '2026-11-07T02:22:48.976Z');
  assert.ok(!postSchema(SITE, { slug: 'x', title: '</script>' }).includes('</script>'));
});
