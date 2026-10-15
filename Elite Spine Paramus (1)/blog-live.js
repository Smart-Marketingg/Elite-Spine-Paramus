// Adds posts published from the admin portal to the top of the blog grid.
(function () {
  if (!/^https?:$/.test(location.protocol)) return;
  var grid = document.querySelector('.blog-grid');
  if (!grid) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var existing = {};
  grid.querySelectorAll('a.bcard').forEach(function (a) { var m = a.href.match(/post=([^&]+)/); if (m) existing[decodeURIComponent(m[1])] = 1; });
  fetch('/api/posts', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : { posts: [] }; })
    .then(function (d) {
      var frag = document.createDocumentFragment();
      (d.posts || []).forEach(function (p) {
        if (existing[p.slug]) return;
        var mins = Math.max(1, Math.round((p.len || 0) / 1300)) + ' min read';
        var a = document.createElement('a');
        a.className = 'bcard';
        a.href = 'blog-post.html?post=' + encodeURIComponent(p.slug);
        a.innerHTML =
          '<div class="bcard__img"><img loading="lazy" src="' + esc(p.hero || 'images/clinic-opt.jpg') + '" alt="' + esc(p.title) + '" /></div>' +
          '<div class="bcard__body">' +
            '<div class="bcard__meta"><span>' + esc(p.category || 'Wellness') + '</span><span class="dot"></span><span>' + mins + '</span></div>' +
            '<h3>' + esc(p.title) + '</h3>' +
            '<p>' + esc(p.excerpt || '') + '</p>' +
            '<span class="bcard__more">Read More<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg></span>' +
          '</div>';
        frag.appendChild(a);
      });
      grid.insertBefore(frag, grid.firstChild);
    })
    .catch(function () {});
})();
