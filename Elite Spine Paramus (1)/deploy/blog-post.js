// ============================================================
//  Blog post renderer — reads ?post=slug.
//  Renders built-in articles from BLOG_POSTS, or posts published
//  from the admin portal via /api/posts.
// ============================================================
(function () {
  var posts = window.BLOG_POSTS || {};
  var slug = new URLSearchParams(location.search).get('post');
  var live = /^https?:$/.test(location.protocol);

  function set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val || ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
  function readTime(html) { var d = document.createElement('div'); d.innerHTML = html || ''; return Math.max(1, Math.round((d.textContent || '').split(/\s+/).filter(Boolean).length / 220)) + ' min read'; }
  function fromApi(p) {
    return { title: p.title, category: p.category || 'Wellness', date: fmt(p.publish_at), read: readTime(p.body_html || ''), hero: p.hero || 'images/clinic-opt.jpg', excerpt: p.excerpt || '', html: p.body_html, seoTitle: p.seo_title, seoDesc: p.seo_description };
  }

  function render(post) {
    document.title = (post.seoTitle || post.title) + ' — Elite Spine & Sports Care | Paramus, NJ';
    var metaDesc = document.querySelector('meta[name="description"]');
    var desc = post.seoDesc || post.excerpt;
    if (metaDesc && desc) metaDesc.setAttribute('content', desc);

    var heroImg = document.getElementById('artHeroImg');
    if (heroImg) { heroImg.src = post.hero; heroImg.alt = post.title; }
    set('artTag', post.category);
    set('artDate', post.date);
    set('artRead', post.read);
    set('artTitle', post.title);
    set('artCrumb', post.category);

    var body = document.getElementById('artBody');
    if (!body) return;
    if (post.html) { body.innerHTML = post.html; return; } // sanitized server-side on save
    (post.body || []).forEach(function (block) {
      var node;
      if (block.h2) { node = document.createElement('h2'); node.textContent = block.h2; }
      else if (block.p) { node = document.createElement('p'); node.textContent = block.p; }
      else if (block.list) {
        node = document.createElement('ul');
        block.list.forEach(function (item) { var li = document.createElement('li'); li.textContent = item; node.appendChild(li); });
      }
      if (node) body.appendChild(node);
    });
  }

  function renderMore(liveList) {
    var grid = document.getElementById('moreGrid');
    if (!grid) return;
    var items = (liveList || []).map(function (p) { return [p.slug, fromApi(p)]; })
      .concat(Object.keys(posts).map(function (k) { return [k, posts[k]]; }))
      .filter(function (x) { return x[0] !== slug; }).slice(0, 3);
    items.forEach(function (x) {
      var p = x[1];
      var a = document.createElement('a');
      a.className = 'bcard';
      a.href = 'blog-post.html?post=' + encodeURIComponent(x[0]);
      a.innerHTML =
        '<div class="bcard__img"><img src="' + esc(p.hero) + '" alt="' + esc(p.title) + '" /></div>' +
        '<div class="bcard__body">' +
          '<div class="bcard__meta"><span>' + esc(p.category) + '</span><span class="dot"></span><span>' + esc(p.read) + '</span></div>' +
          '<h3>' + esc(p.title) + '</h3>' +
          '<p>' + esc(p.excerpt) + '</p>' +
          '<span class="bcard__more">Read More' +
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>' +
          '</span>' +
        '</div>';
      grid.appendChild(a);
    });
  }

  function getJSON(url) { return fetch(url, { headers: { Accept: 'application/json' } }).then(function (r) { if (!r.ok) throw 0; return r.json(); }); }
  var listReq = live ? getJSON('/api/posts').then(function (d) { return d.posts || []; }).catch(function () { return []; }) : Promise.resolve([]);

  if (slug && posts[slug]) {
    render(posts[slug]);
    listReq.then(renderMore);
  } else if (slug && live) {
    getJSON('/api/posts?slug=' + encodeURIComponent(slug))
      .then(function (d) { render(fromApi(d.post)); return listReq.then(renderMore); })
      .catch(function () { location.replace('blog.html'); });
  } else {
    location.replace('blog.html');
    return;
  }
  window.scrollTo(0, 0);
})();
