// 在首页横幅背景中插入视频。
// 放在项目 scripts/ 目录下，Hexo 会自动加载，主题升级不会覆盖。
// 原来的 <img>（封面图）保留在视频下方，作为加载前、手机端和减少动态效果时的回退。

const VIDEO = '/videos/banner.mp4';
const POSTER = '/images/banner-poster.jpg';

const style = `<style>
.banner-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1}
html.dark .banner-video{filter:brightness(.7)}
@media (max-width:768px),(prefers-reduced-motion:reduce){.banner-video{display:none}}
</style>`;

const video = `<video class="banner-video" src="${VIDEO}" poster="${POSTER}" autoplay muted loop playsinline preload="metadata" aria-hidden="true"></video>`;

hexo.extend.filter.register('after_render:html', (html) => {
  if (!html.includes('home-banner-background')) return html;
  return html
    .replace(/(<div class="home-banner-background[^>]*>)/g, `$1${video}`)
    .replace('</head>', `${style}</head>`);
});
