---
title: 从深度学习环境到个人博客上线：我的第一篇记录
date: 2026-10-22 20:00:00
categories:
  - 开发笔记
tags:
  - Hexo
  - GitHub Pages
  - 深度学习
  - SSH
---

这是博客的第一篇文章，记录两件事：我怎么为《动手学深度学习》搭好学习环境，以及这个博客是怎么从零搭起来的。过程里踩了不少坑，我把它们连同解决办法一起写下来，既是给以后的自己留个备忘，也希望能帮到遇到同样问题的人。

<!-- more -->

> 说明：文中涉及服务器地址、用户名、邮箱的地方都用了占位符，比如 `<服务器域名>`。

## 一、深度学习学习环境

### 1. 方案选择

我跟的是李沐老师的《动手学深度学习》v2。一开始先想清楚算力放在哪：

| 设备 | 用途 |
|---|---|
| 本地 Mac（Apple 芯片） | 看视频、写代码、跑前几章的小模型 |
| 实验室 GPU 服务器（RTX A4000 16GB） | 跑 CNN 及之后需要算力的章节 |
| 云 GPU 平台（如 AutoDL，备选） | 没有实验室服务器时按小时租用 |

### 2. 本地 Mac 环境

```bash
conda create -n d2l python=3.9 -y
conda activate d2l
pip install torch torchvision jupyter
pip install d2l==0.17.6
```

这里有个容易忽略的点：李沐 v2 的课程视频对应 d2l 0.17.x，而网页版新书用的是 1.x，函数名有变化。**跟视频学，就装 0.17.6。**

Mac 上想用 GPU 要走 MPS。书里的 `d2l.try_gpu()` 只检测 CUDA，在 Mac 上会退回 CPU，所以需要手动指定设备：

```python
import torch
device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
```

遇到 MPS 不支持的算子，可以让它自动退回 CPU：

```bash
export PYTORCH_ENABLE_MPS_FALLBACK=1
```

### 3. 用 Cloudflare Tunnel 连内网 GPU 服务器

服务器在实验室局域网里，没有公网 IP，我用 Cloudflare Tunnel 穿透进去。Mac 端先装 `cloudflared`：

```bash
brew install cloudflared
which cloudflared
```

然后编辑 `~/.ssh/config`，让 SSH 通过 `cloudflared` 转发：

```text
Host gpu-server
    HostName <服务器域名>
    User <服务器用户名>
    ProxyCommand /opt/homebrew/bin/cloudflared access ssh --hostname %h
```

`ProxyCommand` 建议写 `cloudflared` 的**绝对路径**，否则 VS Code 启动 SSH 时可能找不到它。配好后就能连：

```bash
ssh gpu-server
```

### 4. 配置 SSH 免密登录

```bash
ssh-keygen -t ed25519
ssh-copy-id gpu-server
```

- `ssh-keygen`：在本地生成一对密钥。`~/.ssh/id_ed25519` 是私钥，绝对不能外泄；`id_ed25519.pub` 是公钥。
- `ssh-copy-id`：把公钥追加到服务器的 `~/.ssh/authorized_keys`，之后登录不再需要密码。

**踩坑：** Mac 默认的 zsh 在交互终端里**不把 `#` 当注释**。把 `ssh-keygen -t ed25519   # 注释` 整行粘贴进去，会报 `Too many arguments`。可以执行下面这条开启注释支持：

```bash
echo 'setopt interactivecomments' >> ~/.zshrc
```

### 5. 服务器上的环境

```bash
nvidia-smi
conda create -n d2l python=3.9 -y
conda activate d2l
pip install torch torchvision jupyter
pip install d2l==0.17.6
```

验证 GPU 是否可用：

```bash
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```

下载课程 notebook：

```bash
mkdir -p ~/d2l-zh && cd ~/d2l-zh
wget https://zh-v2.d2l.ai/d2l-zh.zip
unzip d2l-zh.zip
```

### 6. 两种使用方式

**方式一：VS Code Remote-SSH（推荐）**

1. 安装 Remote - SSH 插件。
2. `Cmd+Shift+P` → `Remote-SSH: Connect to Host` → 选择 `gpu-server`。
3. 在远程端安装 Python 和 Jupyter 插件。
4. 打开 `.ipynb`，右上角选择内核 `d2l`。

**方式二：浏览器 Jupyter + 端口转发（李沐视频里的方式）**

服务器上启动 Jupyter：

```bash
conda activate d2l
jupyter notebook --no-browser --port=8888
```

在 Mac 上另开一个终端做端口转发：

```bash
ssh -L 8888:localhost:8888 gpu-server
```

然后浏览器打开 `localhost:8888` 即可。

### 7. Windows 电脑连同一台服务器

我还有一台 Windows 电脑，用 PowerShell 配置：

```powershell
winget install --id Cloudflare.cloudflared
where.exe cloudflared
mkdir $env:USERPROFILE\.ssh -Force
notepad $env:USERPROFILE\.ssh\config
```

配置内容和 Mac 类似，区别是 `ProxyCommand` 的路径有空格，**必须加引号**：

```text
Host gpu-server
    HostName <服务器域名>
    User <服务器用户名>
    ProxyCommand "C:\Program Files (x86)\cloudflared\cloudflared.exe" access ssh --hostname %h
```

保存时文件名必须是 `config`，不能带 `.txt` 后缀。Windows 没有 `ssh-copy-id`，用管道代替：

```powershell
ssh-keygen -t ed25519
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh gpu-server "cat >> ~/.ssh/authorized_keys"
```

## 二、搭建博客：Hexo + Redefine + GitHub Pages

### 1. 为什么不用服务器和域名

我原本以为搭博客得先买云服务器和域名，其实完全不用。博客是**静态站点**，写好的 Markdown 会被编译成一堆 HTML，丢给 GitHub Pages 免费托管就行，默认域名 `<用户名>.github.io` 也够用。

整个流程是：

> 本地写 Markdown → `git push` → GitHub Actions 自动构建 → 网站更新

简历主页我打算单独放，因为 GitHub 每个账号只有一个 `<用户名>.github.io` 根站点，所以简历放在一个免费的 GitHub 组织下。另外要注意，免费账号只有 **Public** 仓库才能开启 Pages。

### 2. 安装 Hexo 并创建站点

```bash
brew install node
node -v
npm install -g hexo-cli

cd ~
hexo init <用户名>.github.io
cd <用户名>.github.io
npm install
```

### 3. 安装 Redefine 主题

```bash
npm install hexo-theme-redefine@latest
cp node_modules/hexo-theme-redefine/_config.yml _config.redefine.yml
```

根目录 `_config.yml` 里写站点基本信息，并指定主题：

```yaml
title: 博客名称
author: <用户名>
language: zh-CN
timezone: Asia/Shanghai
url: https://<用户名>.github.io
theme: redefine
```

**主题配置要改根目录的 `_config.redefine.yml`，不要改 `node_modules` 里的那份。** 后者不会被提交，升级主题时还会被覆盖。

本地预览：

```bash
hexo clean
hexo server
```

浏览器打开 `http://localhost:4000` 就能看到。

### 4. GitHub Actions 自动部署

新建 `.github/workflows/pages.yml`，大意是：push 到 `main` 后，先 `npm ci` 安装依赖，再 `npm run build` 生成 `public/`，最后发布到 GitHub Pages。

```yaml
name: Deploy Blog

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./public
  # deploy 任务：用 actions/deploy-pages@v4 发布，这里省略
```

`node-version` 填本地 `node -v` 输出的大版本号。然后在仓库 **Settings → Pages → Source** 选择 **GitHub Actions**，不是默认的 "Deploy from a branch"。这一步漏了，Actions 跑得再绿，网站也不会更新。

### 5. 配置 GitHub SSH 并首次推送

```bash
ssh-keygen -t ed25519 -C "<邮箱>"
cat ~/.ssh/id_ed25519.pub
```

把输出的公钥添加到 GitHub → Settings → SSH and GPG keys。密钥保存在每台电脑本地，**每台电脑都要单独生成并添加**，标题用设备名区分。

```bash
ssh -T git@github.com
git config --global user.name "<用户名>"
git config --global user.email "<邮箱>"

git init
git branch -M main
git add .
git commit -m "Initial blog with Hexo and Redefine"
git remote add origin git@github.com:<用户名>/<用户名>.github.io.git
git push -u origin main
```

`-u` 把本地 `main` 和远程 `origin/main` 绑定，以后直接 `git push` / `git pull` 就行。

## 三、三个踩坑

### 坑 1：代理导致 SSH 推送失败

报错：

```text
Connection closed by 198.18.0.27 port 22
fatal: Could not read from remote repository.
```

`198.18.x.x` 是代理工具 Fake IP 模式的虚拟地址，22 端口被代理拦截了。解决办法是让 SSH 改走 GitHub 支持的 **443 端口**。可以在 `~/.ssh/config` 里追加：

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
    HostName ssh.github.com
    Port 443
    User git
EOF
```

我是用命令写入的，因为之前用编辑器改这个文件时出现过没保存成功的情况。或者干脆把仓库远程地址改成 443 端口，不依赖 SSH 配置：

```bash
git remote set-url origin ssh://git@ssh.github.com:443/<用户名>/<用户名>.github.io.git
```

### 坑 2：node_modules 被提交进了仓库

首次推送上传了 7000 多个对象、17MB，明显不对。检查一下：

```bash
cat .gitignore
git ls-files | grep -c node_modules
```

原因是 `hexo init` 并没有生成 `.gitignore`。补上，然后把已经被跟踪的文件从 Git 里摘掉：

```bash
cat > .gitignore <<'EOF'
node_modules/
public/
db.json
.deploy*/
.DS_Store
*.log
EOF

git rm -r --cached node_modules
git rm --cached db.json
git add .gitignore
git commit -m "Add .gitignore and remove node_modules"
git push
```

这里有个关键点：**`.gitignore` 只对还没被跟踪的文件生效**。文件一旦进了 Git，光写进 `.gitignore` 是没用的，必须用 `git rm --cached` 把它从索引里移除。`--cached` 只停止跟踪，不会删除本地文件。依赖不需要进仓库，Actions 部署时会按 `package.json` 重新安装。

### 坑 3：改了配置，网页却没变

这个坑最让我困惑：我改了基础信息和主题外观，也 push 了，Actions 也是绿的，线上页面标题却还是主题的默认值。

排查下来原因有两个：

1. **改错了地方。** 我改的是 `_config.redefine.yml` 里被 `#` 注释掉的导航示例，注释的行不会生效；而 Redefine 的标题读的是 `_config.redefine.yml` 里的 `info.title` 和 `home_banner.title`，并不是根目录 `_config.yml` 的 `title`。
2. **缓存。** GitHub Pages 给页面设置了 10 分钟缓存，刚部署完刷新，看到的可能还是旧页面，用 `Cmd+Shift+R` 强制刷新。

对应的修改：

```yaml
info:
  title: Jizhe's Blog
  subtitle: 学习与项目开发记录
  author: Jizhe Nie
  url: https://jizhe-nie.github.io

home_banner:
  title: Jizhe's Blog
```

顺便踩到一个小细节：如果把 `info.subtitle` 设成空，主题会回退到它自己的默认广告语 "Redefine Your Hexo Journey."，浏览器标签页标题就会带着它，所以副标题最好写点自己的话。

还有一个相关的发现：**博客没有任何文章时，Hexo 不会生成首页 `index.html`**，首页会直接 404。所以示例文章要等第一篇真正的文章写好后再删。

## 四、把模板改成自己的

### 导航、头像和站点图标

导航栏里取消注释，启用 Archives 和 About：

```yaml
navbar:
  links:
    Archives:
      path: /archives
      icon: fa-regular fa-archive
    About:
      icon: fa-regular fa-user
      submenus:
        Me: https://<组织名>.github.io
        Github: https://github.com/<用户名>
```

头像我用的是 iPhone 导出的 HEIC 格式，浏览器不支持。macOS 自带的 `sips` 可以直接转格式：

```bash
sips -s format png IMG_1529.HEIC --out avatar-src.png
```

再用 `ffmpeg` 缩放成 512×512 的头像和 128×128 的站点图标，放进 `source/images/`，然后在配置里指向它们：

```yaml
defaults:
  favicon: /images/favicon.png
  avatar: /images/avatar.png
```

### 动态视频背景

我想要类似 macOS 动态壁纸的首页背景，但 Redefine 的横幅只支持图片。我的做法是写一个 Hexo 脚本：放在项目的 `scripts/` 目录下，Hexo 会自动加载它，主题升级也不会被覆盖。脚本在生成页面时，往横幅里插入一个 `<video>`：

```js
hexo.extend.filter.register('after_render:html', (html) => {
  if (!html.includes('home-banner-background')) return html;
  return html
    .replace(/(<div class="home-banner-background[^>]*>)/g, `$1${video}`)
    .replace('</head>', `${style}</head>`);
});
```

原来的封面图保留在视频下面，手机端（宽度 ≤768px）和系统开启"减少动态效果"时，直接隐藏视频、只显示封面图，省流量也省电。深色模式下视频自动调暗。

下载来的原视频是 4K、60 帧、22 秒，**172MB**，直接放上去首页会慢到没法用。用 `ffmpeg` 压缩后只有 **4MB**：

```bash
ffmpeg -i 原视频.mp4 -an -vf "scale=1920:-2,fps=30" \
  -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p \
  -movflags +faststart banner.mp4
```

每个参数的作用：

- `-an`：去掉音轨，背景视频要静音，音频纯属浪费。
- `scale=1920:-2`：宽度缩到 1920，高度按比例自动算，`-2` 保证是偶数（H.264 的要求）。
- `fps=30`：60 帧降到 30 帧，背景视频看不出区别，体积直接减半。
- `-crf 28`：画质参数，数字越大文件越小、画质越低，28 适合背景。
- `-pix_fmt yuv420p`：保证 Safari 和手机兼容。
- `-movflags +faststart`：把索引放到文件开头，网页不用下完整个文件就能开始播放。

### GitHub 贡献日历

我还想在首页放一个 GitHub 贡献日历。做法是：

1. `tools/contributions.mjs` 抓取 GitHub 公开的贡献数据，保存成 `source/_data/contributions.json`。
2. `scripts/contributions.js` 在构建首页时把数据画成内联 SVG，插在文章列表下方。用内联 SVG 而不是图片，是为了让颜色能跟随深色模式切换。
3. 在 `pages.yml` 里加上定时触发，每天重建一次，日历就自动更新：

```yaml
on:
  schedule:
    - cron: "0 0 * * *"
  workflow_dispatch:
```

抓取脚本失败时只打印警告、保留旧数据，不会让整个博客构建失败。

## 五、日常写作流程

现在我写一篇新文章的流程是：

```bash
git pull
hexo new "文章标题"
hexo server
git add .
git commit -m "新文章：文章标题"
git push
```

多台电脑同步的原则是：**开工先 pull，收工必 push**。在另一台电脑上第一次使用：

```bash
git clone <仓库地址>
cd <用户名>.github.io
npm install
```

## 小结与后续计划

回头看，这次最大的收获是搞清楚了"为什么"，而不只是"怎么做"：`.gitignore` 为什么管不了已跟踪的文件、主题配置为什么要放根目录、代理为什么会让 SSH 走不通。这些东西搞明白了，下次遇到类似的问题，就知道往哪里查。

接下来打算做这几件事：

1. 搭一个独立的个人简历主页，博客导航里的 About 指向它。
2. 配置 GitHub 个人主页的 README，用 Action 读取博客 RSS，自动展示最新文章。
3. 写几篇之后，做一个 AI 一键发布工具：输入要点和图片，让大模型整理成 Markdown，我预览确认后自动推送发布。
4. 继续《动手学深度学习》的学习笔记，用这篇里搭好的环境跑起来。
