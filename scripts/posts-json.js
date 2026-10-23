// 生成 /posts.json：站点所有文章的简要列表，供外部使用（如 GitHub 个人主页 README 自动展示最新文章）。
// 字段：title、url、date、lang（zh / en）、translation（对应另一种语言文章的 url，没有则为 null）。
// 按日期从新到旧排列。

hexo.extend.generator.register('posts-json', (locals) => {
  const base = String(hexo.config.url).replace(/\/+$/, '');
  const posts = locals.posts.sort('-date').toArray();
  const bySlug = {};
  posts.forEach((p) => { bySlug[p.slug] = p; });

  const list = posts.map((p) => {
    const other = p.translation && bySlug[p.translation];
    return {
      title: p.title,
      url: `${base}/${p.path}`,
      date: p.date.format('YYYY-MM-DD'),
      lang: p.post_lang || 'zh',
      translation: other ? `${base}/${other.path}` : null,
    };
  });

  return { path: 'posts.json', data: JSON.stringify({ generated: new Date().toISOString(), posts: list }, null, 2) };
});
