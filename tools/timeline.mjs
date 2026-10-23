// 读取博客和简历站两个仓库的 Git 提交记录，写入 source/_data/timeline.json，
// 供"建站时间线"页面使用（页面见 scripts/timeline.js）。
//
// 用法：node tools/timeline.mjs
//   - 博客仓库：直接读本地的 git log（CI 里 checkout 需要 fetch-depth: 0，否则历史不全）
//   - 简历站仓库：用 git clone --bare --filter=blob:none 拉取（只要提交和文件列表，不下载文件内容）
// 某个仓库读取失败时，保留 timeline.json 里它原来的数据，不让构建失败。

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const OUT = 'source/_data/timeline.json';

const REPOS = [
  { id: 'blog', url: 'https://github.com/jizhe-nie/jizhe-nie.github.io', local: true },
  { id: 'resume', url: 'https://github.com/qianlong-nie/qianlong-nie.github.io' },
];

// 这些目录里的文件变动太多且没有阅读价值（如首次误提交的 node_modules），只计数不列出
const NOISY = /^(node_modules|vendor|_site|public)\//;
const MAX_FILES = 30;

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

function readLog(gitArgs, repo) {
  const out = git([...gitArgs, 'log', '--no-renames', '--name-status', '--format=@@%H%x09%aI%x09%s']);
  const entries = [];
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('@@')) {
      const [hash, date, ...subject] = line.slice(2).split('\t');
      cur = {
        repo: repo.id,
        hash,
        short: hash.slice(0, 7),
        date,
        subject: subject.join('\t'),
        url: `${repo.url}/commit/${hash}`,
        files: [],
        total: 0,
        hidden: 0,
      };
      entries.push(cur);
    } else if (cur && line.trim()) {
      const [status, path] = line.split('\t');
      cur.total += 1;
      if (NOISY.test(path)) cur.hidden += 1;
      else if (cur.files.length < MAX_FILES) cur.files.push({ s: status, p: path });
    }
  }
  return entries;
}

function load(repo) {
  if (repo.local) {
    if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') {
      throw new Error('本地仓库是浅克隆，历史不完整（CI 里请用 fetch-depth: 0）');
    }
    return readLog([], repo);
  }
  const dir = mkdtempSync(join(tmpdir(), 'timeline-'));
  try {
    git(['clone', '--bare', '--filter=blob:none', '--quiet', repo.url, dir]);
    return readLog(['--git-dir', dir], repo);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

let previous = [];
try {
  if (existsSync(OUT)) previous = JSON.parse(readFileSync(OUT, 'utf8')).entries || [];
} catch (e) {
  console.warn(`timeline: 旧数据读取失败（${e.message}）`);
}

const entries = [];
for (const repo of REPOS) {
  try {
    const got = load(repo);
    console.log(`timeline: ${repo.id} ${got.length} 条提交`);
    entries.push(...got);
  } catch (e) {
    const old = previous.filter((x) => x.repo === repo.id);
    console.warn(`timeline: ${repo.id} 读取失败，沿用旧数据 ${old.length} 条（${e.message.split('\n')[0]}）`);
    entries.push(...old);
  }
}

entries.sort((a, b) => new Date(b.date) - new Date(a.date));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), entries }, null, 1));
console.log(`timeline: 共 ${entries.length} 条，已写入 ${OUT}`);
