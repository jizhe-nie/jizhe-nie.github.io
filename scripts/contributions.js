// 在首页文章列表下方插入 GitHub 贡献日历（内联 SVG，跟随深色模式）。
// 数据来自 source/_data/contributions.json，由 tools/contributions.mjs 生成。

const fs = require('fs');
const path = require('path');

const CELL = 11, GAP = 3, STEP = CELL + GAP, LEFT = 28, TOP = 18;

function render(data) {
  const cols = Math.max(...data.days.map((d) => d.col)) + 1;
  const width = LEFT + cols * STEP;
  const height = TOP + 7 * STEP;

  const rects = data.days.map((d) => {
    const x = LEFT + d.col * STEP, y = TOP + d.row * STEP;
    const tip = `${d.date}：${d.count} 次贡献`;
    return `<rect class="gh-l${d.level}" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2"><title>${tip}</title></rect>`;
  }).join('');

  // 月份标签：每列第一格的月份与上一列不同时标注
  const months = [];
  let last = -1;
  for (let c = 0; c < cols; c++) {
    const first = data.days.find((d) => d.col === c && d.row === 0);
    if (!first) continue;
    const m = +first.date.slice(5, 7);
    if (m !== last) { months.push(`<text x="${LEFT + c * STEP}" y="10">${m}月</text>`); last = m; }
  }
  const weekdays = [['一', 1], ['三', 3], ['五', 5]]
    .map(([n, r]) => `<text x="0" y="${TOP + r * STEP + 9}">${n}</text>`).join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="GitHub 贡献日历">${months.join('')}${weekdays}${rects}</svg>`;
}

const style = `<style>
.gh-contrib{margin:20px auto 0;max-width:1000px;padding:16px 20px;border-radius:14px;background:var(--background-color-transparent-80,rgba(255,255,255,.8))}
.gh-contrib h3{margin:0 0 10px;font-size:15px;font-weight:600}
.gh-contrib h3 a{color:inherit;text-decoration:none}
.gh-contrib .gh-scroll{overflow-x:auto}
.gh-contrib svg{display:block;min-width:700px;width:100%;height:auto;font-size:9px;fill:currentColor;opacity:.95}
.gh-l0{fill:#ebedf0}.gh-l1{fill:#9be9a8}.gh-l2{fill:#40c463}.gh-l3{fill:#30a14e}.gh-l4{fill:#216e39}
html.dark .gh-l0{fill:#2d333b}html.dark .gh-l1{fill:#0e4429}html.dark .gh-l2{fill:#006d32}html.dark .gh-l3{fill:#26a641}html.dark .gh-l4{fill:#39d353}
</style>`;

hexo.extend.filter.register('after_render:html', (html) => {
  if (!html.includes('home-article-list') || !html.includes('<div class="main-content-footer">')) return html;
  const file = path.join(hexo.source_dir, '_data', 'contributions.json');
  if (!fs.existsSync(file)) return html;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));

  const block = `<div class="gh-contrib"><h3><a href="https://github.com/${data.user}" target="_blank" rel="noopener">GitHub 贡献日历</a> · 过去一年 ${data.total} 次贡献</h3><div class="gh-scroll">${render(data)}</div></div>`;
  return html
    .replace('<div class="main-content-footer">', `${block}<div class="main-content-footer">`)
    .replace('</head>', `${style}</head>`);
});
