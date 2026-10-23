// 博客中英文切换（运行期部分）。构建期部分见 scripts/bilingual.js。
// <html data-lang> 已由 <head> 里的内联脚本提前设好，这里负责：
// - 点击切换按钮时更新语言并记住选择
// - 更新页面标题（<title> 上记着 data-zh / data-en）
// - 文章列表里隐藏"另一种语言"的配对文章
// - 在文章页，如果当前语言和文章语言不同且有配对版本，跳转到配对版本
(function () {
  var root = document.documentElement;

  function lang() {
    return root.getAttribute('data-lang') === 'en' ? 'en' : 'zh';
  }

  function normalize(p) {
    try { p = decodeURIComponent(p); } catch (e) {}
    return p.replace(/\/index\.html$/, '').replace(/\/+$/, '');
  }

  function updateTitle() {
    var t = document.querySelector('title');
    var v = t && t.getAttribute('data-' + lang());
    if (v) document.title = v;
  }

  // 文章链接所在的列表项
  function container(a) {
    return a.closest('li, .home-article-item, .article-nav-item') || a;
  }

  var POST_PATH = /^\/\d{4}\/\d{2}\/\d{2}\//;

  function postLinks(c) {
    return Array.prototype.filter.call(c.querySelectorAll('a[href]'), function (x) {
      return POST_PATH.test(x.pathname);
    });
  }

  function filterPosts() {
    var pairs = window.__postPairs || {};
    var cur = lang();

    document.querySelectorAll('[data-lang-hidden]').forEach(function (el) {
      el.removeAttribute('data-lang-hidden');
    });

    var here = normalize(location.pathname);
    var touched = [];
    document.querySelectorAll('a[href]').forEach(function (a) {
      var info = pairs[normalize(a.pathname)];
      if (!info || info.lang === cur) return;
      if (normalize(a.pathname) === here) return; // 不隐藏当前页自己的链接
      var c = container(a);
      // 归档页把同一天的文章放在同一个 li 里：这种情况只隐藏链接本身
      if (c !== a && postLinks(c).length > 1) {
        a.setAttribute('data-lang-hidden', '');
        if (touched.indexOf(c) < 0) touched.push(c);
      } else {
        c.setAttribute('data-lang-hidden', '');
      }
    });

    // 一个容器里的文章链接如果都被隐藏了，就把整个容器也隐藏
    touched.forEach(function (c) {
      var all = postLinks(c);
      var hidden = all.filter(function (x) { return x.hasAttribute('data-lang-hidden'); });
      if (all.length && hidden.length === all.length) c.setAttribute('data-lang-hidden', '');
    });

    // 当前就是一篇文章，且语言不对、又有配对版本：跳过去
    var self = pairs[here];
    if (self && self.lang !== cur) {
      location.replace(self.alt + location.hash);
    }
  }

  function apply() {
    root.setAttribute('lang', lang() === 'zh' ? 'zh-CN' : 'en');
    updateTitle();
    filterPosts();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.lang-toggle');
    if (!btn) return;
    e.preventDefault();
    var next = lang() === 'zh' ? 'en' : 'zh';
    root.setAttribute('data-lang', next);
    try { localStorage.setItem('lang', next); } catch (err) {}
    apply();
  });

  apply();
})();
