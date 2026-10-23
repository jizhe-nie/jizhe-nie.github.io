// 博客中英文切换（构建期部分）。运行期部分见 source/js/bilingual.js。
//
// 1. 包装模板里的 __()，让主题的界面文字同时返回中英两份（内部用私有区字符做标记）。
// 2. 配置里的自定义文字也可以直接写 [[中文|English]]（如 info.subtitle、info.author）。
// 3. 构建 HTML 时把 [[中文|English]] 按所在位置展开：
//    - script/style 里、标签属性里：只保留中文（这些地方放不了两份）
//    - <title>：保留中文，同时用 data-zh / data-en 记录两种语言，切换时由 JS 更新
//    - 正文文字里：展开成两个 <span class="i18n zh|en">，由 <html data-lang> 控制显示
// 4. 文章可以有对应的另一种语言版本：front-matter 写 post_lang（zh/en，默认 zh）和
//    translation（对应文章的文件名，不含 .md）。页面里嵌入一份文章配对表，运行期据此
//    在列表里隐藏另一种语言的版本，并在文章页切换语言时跳转到对应版本。

// 配置文件里手写的标记：[[中文|English]]（只用于简单文字）
const CFG_MARK = /\[\[([^\[\]|]+)\|([^\[\]|]+)\]\]/g;
// 内部标记：用私有区字符，不会和任何内容冲突（主题的翻译里有的带 SVG 图标）
const MARK = /\uE000([\s\S]*?)\uE001([\s\S]*?)\uE002/g;

// ---- 1. 包装 __() ----
hexo.extend.filter.register('template_locals', (locals) => {
  const i18n = hexo.theme.i18n;
  const zh = i18n.__(['zh-CN', 'default']);
  const en = i18n.__(['en', 'default']);
  locals.__ = (key, ...args) => {
    const a = zh(key, ...args);
    const b = en(key, ...args);
    return a === b ? a : `\uE000${a}\uE001${b}\uE002`;
  };
}, 20);

// ---- 4. 文章配对表 ----
const normalize = (p) => ('/' + p).replace(/\/index\.html$/, '').replace(/\/+$/, '');

function buildPairs() {
  const posts = hexo.locals.get('posts').toArray();
  const bySlug = {};
  posts.forEach((p) => { bySlug[p.slug] = p; });
  const pairs = {};
  posts.forEach((p) => {
    if (!p.translation) return;
    const other = bySlug[p.translation];
    if (!other) {
      hexo.log.warn(`[bilingual] ${p.slug} 的 translation "${p.translation}" 找不到对应文章`);
      return;
    }
    pairs[normalize(p.path)] = { lang: p.post_lang || 'zh', alt: '/' + other.path };
  });
  return pairs;
}

// ---- 3. 展开标记 + 注入切换按钮和脚本 ----
const expand = (s, lang) => s.replace(MARK, (m, zh, en) => (lang === 'en' ? en : zh));
const squash = (s) => s.replace(/\s+/g, ' ').trim();

const HEAD_INIT = `<script>(function(){var l;try{l=localStorage.getItem('lang')}catch(e){}
if(l!=='zh'&&l!=='en'){l=(navigator.language||'zh').toLowerCase().indexOf('zh')===0?'zh':'en'}
var r=document.documentElement;r.setAttribute('data-lang',l);r.setAttribute('lang',l==='zh'?'zh-CN':'en');})();</script>
<style>
html[data-lang="zh"] .i18n.en{display:none!important}
html[data-lang="en"] .i18n.zh{display:none!important}
[data-lang-hidden]{display:none!important}
</style>`;

const TOGGLE_LABEL = '<i class="fa-solid fa-language fa-fw"></i> <span class="i18n zh">EN</span><span class="i18n en">中文</span>';
const DESKTOP_ITEM = `<li class="navbar-item"><a class="lang-toggle" href="#" role="button" aria-label="切换语言 / Switch language">${TOGGLE_LABEL}</a></li>`;
const DRAWER_ITEM = `<li class="drawer-navbar-item text-base my-1.5 flex flex-col w-full"><a class="lang-toggle" href="#" role="button" aria-label="切换语言 / Switch language">${TOGGLE_LABEL}</a></li>`;

hexo.extend.filter.register('after_render:html', (html) => {
  if (!html.includes('</head>')) return html;

  // 先把配置里手写的 [[中文|English]] 统一成内部标记
  html = html.replace(CFG_MARK, '\uE000$1\uE001$2\uE002');

  // <title>：先记下两种语言
  html = html.replace(/<title>([\s\S]*?)<\/title>/, (m, t) => {
    const zh = squash(expand(t, 'zh'));
    const en = squash(expand(t, 'en'));
    return `<title data-zh="${zh}" data-en="${en}">${zh}</title>`;
  });

  // script/style 与标签属性里放不了两份，只保留中文
  html = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (m) => m.replace(MARK, '$1'));
  html = html.replace(/<[a-zA-Z!/][^>]*>/g, (m) => m.replace(MARK, '$1'));

  // 正文文字里展开成两个 span
  html = html.replace(MARK, (m, zh, en) => `<span class="i18n zh">${zh}</span><span class="i18n en">${en}</span>`);

  // 切换按钮：桌面导航栏、手机抽屉菜单
  html = html.replace(/<\/ul>(\s*)<\/div>(\s*)<!-- Mobile -->/, `${DESKTOP_ITEM}</ul>$1</div>$2<!-- Mobile -->`);
  html = html.replace(/(<ul class="drawer-navbar-list[^>]*>)/, `$1${DRAWER_ITEM}`);

  // 初始化脚本、文章配对表、运行期脚本
  const pairs = `<script>window.__postPairs=${JSON.stringify(buildPairs())};</script>`;
  html = html.replace('</head>', `${HEAD_INIT}\n${pairs}\n</head>`);
  html = html.replace('</body>', '<script src="/js/bilingual.js"></script></body>');
  return html;
});
