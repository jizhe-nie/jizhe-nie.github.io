// {% timeline %} 标签：把 source/_data/timeline.json（Git 提交记录，由 tools/timeline.mjs 生成）
// 和 source/_data/timeline-notes.yml（手写说明）渲染成"建站时间线"。
// 文字用私有区字符做双语标记，由 scripts/bilingual.js 在构建 HTML 时展开成中英两份。

const bi = (zh, en) => `${zh}${en}`;
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// 说明里允许用反引号标出命令和文件名
const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

const TAGS = {
  setup: bi('搭建', 'Setup'),
  deploy: bi('部署', 'Deploy'),
  appearance: bi('外观', 'Appearance'),
  feature: bi('功能', 'Feature'),
  fix: bi('排错', 'Fix'),
  content: bi('内容', 'Content'),
};
const REPOS = {
  blog: bi('博客', 'Blog'),
  resume: bi('简历站', 'Résumé site'),
};
const STATUS = { A: '+', M: '~', D: '−' };

const pick = (v, lang) => (v && typeof v === 'object' ? v[lang] : v);
const both = (v, fallback) => {
  const zh = pick(v, 'zh');
  const en = pick(v, 'en');
  return bi(inline(zh || en || fallback || ''), inline(en || zh || fallback || ''));
};

// 说明有两种写法：键是提交的 7 位哈希；或者键是 post:文章文件名（不含 .md），
// 它会对应到"新增了 source/_posts/文章文件名.md"的那次提交。后一种让发布工具能在
// 提交文章的同一个提交里写好说明（那时还不知道提交的哈希）。
const POST_KEY = /^post:(.+)$/;
function noteFor(e, notes) {
  if (notes[e.short]) return notes[e.short];
  const added = new Set(e.files.filter((f) => f.s === 'A').map((f) => f.p));
  for (const key of Object.keys(notes)) {
    const m = POST_KEY.exec(key);
    if (m && added.has(`source/_posts/${m[1]}.md`)) return notes[key];
  }
  return {};
}

function renderEntry(e, notes) {
  const n = noteFor(e, notes);
  const tags = n.tags || [];
  const date = e.date.slice(0, 16).replace('T', ' ');

  const files = e.files.map((f) => `<li><span class="tl-st tl-st-${esc(f.s)}">${STATUS[f.s] || esc(f.s)}</span> ${esc(f.p)}</li>`).join('');
  const more = e.total - e.files.length - e.hidden;
  const extra = [
    more > 0 ? `<li class="tl-more">${bi(`另有 ${more} 个文件`, `${more} more files`)}</li>` : '',
    e.hidden > 0 ? `<li class="tl-more">${bi(`另有 ${e.hidden} 个依赖或构建产物文件（已折叠）`, `${e.hidden} dependency or build files (collapsed)`)}</li>` : '',
  ].join('');

  return [
    `<li class="tl-item" data-repo="${esc(e.repo)}" data-tags="${esc(tags.join(' '))}">`,
    '<span class="tl-dot"></span>',
    `<div class="tl-head"><time>${esc(date)}</time>`,
    `<span class="tl-badge tl-repo-${esc(e.repo)}">${REPOS[e.repo] || esc(e.repo)}</span>`,
    tags.map((t) => `<span class="tl-badge tl-tag">${TAGS[t] || esc(t)}</span>`).join(''),
    '</div>',
    `<div class="tl-title">${both(n.title, e.subject)}</div>`,
    n.note ? `<p class="tl-note">${both(n.note)}</p>` : '',
    `<details class="tl-files"><summary>${bi(`${e.total} 个文件改动`, `${e.total} files changed`)}</summary><ul>${files}${extra}</ul></details>`,
    `<a class="tl-link" href="${esc(e.url)}" target="_blank" rel="noopener"><code>${esc(e.short)}</code> ${bi('在 GitHub 上查看改动', 'View the diff on GitHub')} →</a>`,
    '</li>',
  ].join('');
}

hexo.extend.tag.register('timeline', () => {
  const data = hexo.locals.get('data') || {};
  const tl = data.timeline;
  const notes = data['timeline-notes'] || {};
  if (!tl || !Array.isArray(tl.entries) || !tl.entries.length) {
    return `<p>${bi('时间线数据还没有生成，请运行 node tools/timeline.mjs。', 'Timeline data has not been generated yet. Run node tools/timeline.mjs.')}</p>`;
  }

  const repoChips = Object.keys(REPOS).map((r) => `<button type="button" class="tl-chip" data-kind="repo" data-value="${r}">${REPOS[r]}</button>`).join('');
  const tagChips = Object.keys(TAGS).map((t) => `<button type="button" class="tl-chip" data-kind="tag" data-value="${t}">${TAGS[t]}</button>`).join('');
  const updated = tl.generated.slice(0, 10);

  // 注意：输出必须是不含空行、不以缩进开头的一整块 HTML，否则 Markdown 会把后面的内容当成别的语法解析
  return [
    '<link rel="stylesheet" href="/css/timeline.css">',
    '<div class="tl" id="timeline">',
    `<p class="tl-intro">${bi(
      '这个博客和简历站从零搭建、一路修改的过程。每个时间点都对应一次 Git 提交，点开可以看到当时改了哪些文件，以及为什么这么改、踩了什么坑。方便别人参考，也方便我自己回顾和排查问题。',
      'How this blog and the résumé site were built and changed, step by step. Every point is a Git commit: open it to see which files changed, why, and which pitfalls came up. Useful as a reference for others and for my own review and troubleshooting.'
    )}</p>`,
    `<div class="tl-bar"><div class="tl-chips"><button type="button" class="tl-chip is-active" data-kind="all">${bi('全部', 'All')}</button>${repoChips}${tagChips}</div>`,
    `<button type="button" class="tl-order" id="tl-order"><span class="tl-o-desc">${bi('最新在前', 'Newest first')}</span><span class="tl-o-asc">${bi('最早在前', 'Oldest first')}</span></button></div>`,
    `<ol class="tl-list">${tl.entries.map((e) => renderEntry(e, notes)).join('')}</ol>`,
    `<p class="tl-foot">${bi(`共 ${tl.entries.length} 次提交 · 数据更新于 ${updated}`, `${tl.entries.length} commits · data updated ${updated}`)}</p>`,
    '</div>',
    '<script src="/js/timeline.js"></script>',
  ].join('');
}, { ends: false });
