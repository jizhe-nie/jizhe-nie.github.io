// 抓取 GitHub 公开贡献日历，写入 source/_data/contributions.json。
// 用法：node tools/contributions.mjs [用户名]
// 失败时不抛错、不覆盖旧数据，避免因为网络问题让整个博客构建失败。

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const user = process.argv[2] || 'jizhe-nie';
const out = 'source/_data/contributions.json';

try {
  const res = await fetch(`https://github.com/users/${user}/contributions`, {
    headers: { 'User-Agent': 'blog-contrib-script' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  // 每个格子：<td ... data-date="2025-10-19" id="contribution-day-component-行-列" data-level="0">
  const cells = [...html.matchAll(/<td[^>]*data-date="([\d-]+)"[^>]*id="(contribution-day-component-(\d+)-(\d+))"[^>]*data-level="(\d)"/g)]
    .map(([, date, id, row, col, level]) => ({ date, id, row: +row, col: +col, level: +level }));

  // 具体数量在对应的 <tool-tip for="格子id"> 里："No contributions on ..." 或 "N contribution(s) on ..."
  const counts = new Map();
  for (const [, id, text] of html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>\s*([^<]*?)\s*</g)) {
    const m = text.match(/^(\d+) contributions?/);
    counts.set(id, m ? +m[1] : 0);
  }

  if (cells.length < 300) throw new Error(`只解析到 ${cells.length} 个格子，页面结构可能变了`);

  const days = cells.map(({ date, id, row, col, level }) => ({ date, row, col, level, count: counts.get(id) ?? 0 }));
  const total = days.reduce((s, d) => s + d.count, 0);

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ user, total, updated: new Date().toISOString(), days }));
  console.log(`contributions: ${days.length} 天，共 ${total} 次贡献`);
} catch (e) {
  console.warn(`contributions: 抓取失败，保留旧数据（${e.message}）`);
}
