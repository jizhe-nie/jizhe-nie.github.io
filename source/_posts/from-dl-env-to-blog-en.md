---
title: "From a Deep Learning Setup to a Live Personal Blog: My First Post"
date: 2026-10-22 20:00:00
post_lang: en
translation: from-dl-env-to-blog
categories:
  - Dev Notes
tags:
  - Hexo
  - GitHub Pages
  - Deep Learning
  - SSH
---

This is the first post on my blog, and it covers two things: how I set up an environment for studying *Dive into Deep Learning*, and how this blog was built from scratch. I hit quite a few snags along the way. I'm writing them down together with the fixes, partly as notes for my future self and partly in the hope that it helps someone running into the same problems.

<!-- more -->

> Note: anywhere a server address, username or email would appear, I use a placeholder such as `<server-domain>`.

## 1. A Study Environment for Deep Learning

### 1.1 Choosing where to compute

I'm following Mu Li's *Dive into Deep Learning* (v2). The first thing was to decide where the compute should live:

| Device | Used for |
|---|---|
| Local Mac (Apple silicon) | Watching videos, writing code, running small models in the early chapters |
| Lab GPU server (RTX A4000, 16GB) | CNNs and later chapters that need real compute |
| Cloud GPU platform (e.g. AutoDL, backup) | Hourly rental when no lab server is available |

### 1.2 Local Mac environment

```bash
conda create -n d2l python=3.9 -y
conda activate d2l
pip install torch torchvision jupyter
pip install d2l==0.17.6
```

One easy-to-miss detail: the v2 course videos correspond to d2l 0.17.x, while the current web edition of the book uses 1.x, where some function names have changed. **If you follow the videos, install 0.17.6.**

To use the GPU on a Mac you go through MPS. The book's `d2l.try_gpu()` only checks for CUDA, so on a Mac it falls back to the CPU. Pick the device yourself:

```python
import torch
device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
```

If an operator isn't supported on MPS, let PyTorch fall back to the CPU for it:

```bash
export PYTORCH_ENABLE_MPS_FALLBACK=1
```

### 1.3 Reaching the intranet GPU server through Cloudflare Tunnel

The server sits on the lab's local network with no public IP, so I get in through a Cloudflare Tunnel. On the Mac, install `cloudflared` first:

```bash
brew install cloudflared
which cloudflared
```

Then edit `~/.ssh/config` so SSH is relayed through `cloudflared`:

```text
Host gpu-server
    HostName <server-domain>
    User <server-username>
    ProxyCommand /opt/homebrew/bin/cloudflared access ssh --hostname %h
```

I recommend writing the **absolute path** of `cloudflared` in `ProxyCommand`; otherwise VS Code may fail to find it when it starts SSH. After that you can connect:

```bash
ssh gpu-server
```

### 1.4 Passwordless SSH login

```bash
ssh-keygen -t ed25519
ssh-copy-id gpu-server
```

- `ssh-keygen` generates a key pair locally. `~/.ssh/id_ed25519` is the private key and must never leave your machine; `id_ed25519.pub` is the public key.
- `ssh-copy-id` appends the public key to `~/.ssh/authorized_keys` on the server, so you no longer need a password to log in.

**A gotcha:** the default zsh on macOS **does not treat `#` as a comment** in an interactive terminal. Pasting a whole line like `ssh-keygen -t ed25519   # a comment` fails with `Too many arguments`. You can enable comment support with:

```bash
echo 'setopt interactivecomments' >> ~/.zshrc
```

### 1.5 Setting up the server

```bash
nvidia-smi
conda create -n d2l python=3.9 -y
conda activate d2l
pip install torch torchvision jupyter
pip install d2l==0.17.6
```

Check that the GPU is available:

```bash
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```

Download the course notebooks:

```bash
mkdir -p ~/d2l-zh && cd ~/d2l-zh
wget https://zh-v2.d2l.ai/d2l-zh.zip
unzip d2l-zh.zip
```

### 1.6 Two ways to work

**Option 1: VS Code Remote-SSH (recommended)**

1. Install the Remote - SSH extension.
2. `Cmd+Shift+P` → `Remote-SSH: Connect to Host` → choose `gpu-server`.
3. On the remote side, install the Python and Jupyter extensions.
4. Open an `.ipynb` and pick the `d2l` kernel in the top-right corner.

**Option 2: Jupyter in the browser with port forwarding (the way shown in Mu Li's videos)**

Start Jupyter on the server:

```bash
conda activate d2l
jupyter notebook --no-browser --port=8888
```

On the Mac, open another terminal and forward the port:

```bash
ssh -L 8888:localhost:8888 gpu-server
```

Then open `localhost:8888` in your browser.

### 1.7 Connecting to the same server from Windows

I also have a Windows machine, configured from PowerShell:

```powershell
winget install --id Cloudflare.cloudflared
where.exe cloudflared
mkdir $env:USERPROFILE\.ssh -Force
notepad $env:USERPROFILE\.ssh\config
```

The configuration is similar to the Mac one. The difference is that the `ProxyCommand` path contains spaces, so it **must be quoted**:

```text
Host gpu-server
    HostName <server-domain>
    User <server-username>
    ProxyCommand "C:\Program Files (x86)\cloudflared\cloudflared.exe" access ssh --hostname %h
```

When saving, the file must be named `config`, not `config.txt`. Windows has no `ssh-copy-id`, so pipe the key instead:

```powershell
ssh-keygen -t ed25519
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh gpu-server "cat >> ~/.ssh/authorized_keys"
```

## 2. Building the Blog: Hexo + Redefine + GitHub Pages

### 2.1 Why I don't need a server or a domain

I assumed I'd have to buy a cloud server and a domain first. In fact I don't. A blog is a **static site**: the Markdown you write is compiled into a pile of HTML files and hosted for free on GitHub Pages, and the default domain `<username>.github.io` is good enough.

The whole workflow is:

> write Markdown locally → `git push` → GitHub Actions builds automatically → the site updates

I plan to keep my résumé page separate. Each GitHub account gets only one `<username>.github.io` root site, so the résumé lives under a free GitHub organization. Also note that on a free account only **public** repositories can use Pages.

### 2.2 Installing Hexo and creating the site

```bash
brew install node
node -v
npm install -g hexo-cli

cd ~
hexo init <username>.github.io
cd <username>.github.io
npm install
```

### 2.3 Installing the Redefine theme

```bash
npm install hexo-theme-redefine@latest
cp node_modules/hexo-theme-redefine/_config.yml _config.redefine.yml
```

The root `_config.yml` holds the basic site info and selects the theme:

```yaml
title: Blog name
author: <username>
language: zh-CN
timezone: Asia/Shanghai
url: https://<username>.github.io
theme: redefine
```

**Edit the theme settings in `_config.redefine.yml` at the project root, not the copy inside `node_modules`.** The latter isn't committed and is overwritten whenever the theme is upgraded.

Preview locally:

```bash
hexo clean
hexo server
```

Open `http://localhost:4000` in a browser.

### 2.4 Automatic deployment with GitHub Actions

Create `.github/workflows/pages.yml`. In short: on every push to `main`, install dependencies with `npm ci`, generate `public/` with `npm run build`, then publish it to GitHub Pages.

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
  # deploy job: publishes with actions/deploy-pages@v4 (omitted here)
```

For `node-version`, use the major version printed by `node -v` locally. Then, in the repository under **Settings → Pages → Source**, choose **GitHub Actions** rather than the default "Deploy from a branch". If you skip this, the Actions run can be perfectly green and the site still won't update.

### 2.5 GitHub SSH and the first push

```bash
ssh-keygen -t ed25519 -C "<email>"
cat ~/.ssh/id_ed25519.pub
```

Add the printed public key under GitHub → Settings → SSH and GPG keys. Keys live on each machine, so **every computer needs its own key**; use the device name as the title to tell them apart.

```bash
ssh -T git@github.com
git config --global user.name "<username>"
git config --global user.email "<email>"

git init
git branch -M main
git add .
git commit -m "Initial blog with Hexo and Redefine"
git remote add origin git@github.com:<username>/<username>.github.io.git
git push -u origin main
```

`-u` links the local `main` to the remote `origin/main`, so from then on a plain `git push` / `git pull` is enough.

## 3. Three Pitfalls

### Pitfall 1: A proxy breaks the SSH push

The error:

```text
Connection closed by 198.18.0.27 port 22
fatal: Could not read from remote repository.
```

`198.18.x.x` is a virtual address from the proxy tool's Fake IP mode, and port 22 is being intercepted. The fix is to make SSH go through **port 443**, which GitHub also supports. Append this to `~/.ssh/config`:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
    HostName ssh.github.com
    Port 443
    User git
EOF
```

I wrote it with a command because editing this file in an editor once failed to save. Alternatively, switch the repository's remote to the port-443 address and skip the SSH config altogether:

```bash
git remote set-url origin ssh://git@ssh.github.com:443/<username>/<username>.github.io.git
```

### Pitfall 2: `node_modules` got committed

The first push uploaded more than 7,000 objects and 17MB, which is clearly wrong. Check:

```bash
cat .gitignore
git ls-files | grep -c node_modules
```

The cause: `hexo init` does not generate a `.gitignore`. Add one, then take the already-tracked files out of Git:

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

The key point: **`.gitignore` only affects files that aren't tracked yet.** Once a file is in Git, listing it in `.gitignore` does nothing; you have to remove it from the index with `git rm --cached`. `--cached` only stops tracking and does not delete the local file. Dependencies don't belong in the repository anyway, since Actions reinstalls them from `package.json` on every deploy.

### Pitfall 3: I changed the config but the page didn't

This one confused me the most. I edited the basic info and the theme appearance and pushed, Actions was green, yet the live page still showed the theme's default title.

Two causes turned up:

1. **I edited the wrong place.** I had changed the navigation examples in `_config.redefine.yml` that were commented out with `#`, and commented lines have no effect. Redefine also reads its title from `info.title` and `home_banner.title` in `_config.redefine.yml`, not from `title` in the root `_config.yml`.
2. **Caching.** GitHub Pages serves pages with a 10-minute cache, so right after a deploy you may still see the old page. Force a refresh with `Cmd+Shift+R`.

The corresponding changes:

```yaml
info:
  title: Jizhe's Blog
  subtitle: Learning and project notes
  author: Jizhe Nie
  url: https://jizhe-nie.github.io

home_banner:
  title: Jizhe's Blog
```

A small related detail: if you leave `info.subtitle` empty, the theme falls back to its own default tagline, "Redefine Your Hexo Journey.", and the browser tab title carries it along. So it's best to write your own.

One more finding: **when the blog has no posts, Hexo doesn't generate the home page `index.html`**, so the home page simply returns 404. That's why the sample post should only be deleted once the first real post exists.

## 4. Making the Template My Own

### Navigation, avatar and site icon

In the navbar, uncomment Archives and About:

```yaml
navbar:
  links:
    Archives:
      path: /archives
      icon: fa-regular fa-archive
    About:
      icon: fa-regular fa-user
      submenus:
        Me: https://<org-name>.github.io
        Github: https://github.com/<username>
```

My avatar was exported from an iPhone in HEIC format, which browsers don't support. The `sips` tool built into macOS converts it directly:

```bash
sips -s format png IMG_1529.HEIC --out avatar-src.png
```

Then I used `ffmpeg` to scale it to a 512×512 avatar and a 128×128 site icon, put them in `source/images/`, and pointed the config at them:

```yaml
defaults:
  favicon: /images/favicon.png
  avatar: /images/avatar.png
```

### A video background

I wanted a home-page background like the macOS dynamic wallpapers, but Redefine's banner only accepts images. My approach is a Hexo script: anything in the project's `scripts/` directory is loaded automatically by Hexo, and it won't be overwritten when the theme is upgraded. While generating pages, the script inserts a `<video>` into the banner:

```js
hexo.extend.filter.register('after_render:html', (html) => {
  if (!html.includes('home-banner-background')) return html;
  return html
    .replace(/(<div class="home-banner-background[^>]*>)/g, `$1${video}`)
    .replace('</head>', `${style}</head>`);
});
```

The original cover image stays underneath the video. On mobile (width ≤ 768px) and when the system has "reduce motion" turned on, the video is simply hidden and only the cover image is shown, which saves data and battery. In dark mode the video is dimmed automatically.

The video I downloaded was 4K, 60fps, 22 seconds and **172MB**. Put straight onto the site, it would make the home page unusably slow. Compressed with `ffmpeg` it is only **4MB**:

```bash
ffmpeg -i source.mp4 -an -vf "scale=1920:-2,fps=30" \
  -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p \
  -movflags +faststart banner.mp4
```

What each option does:

- `-an`: drop the audio track. A background video is silent, so audio is pure waste.
- `scale=1920:-2`: scale the width to 1920 and compute the height from the aspect ratio; `-2` keeps it even, which H.264 requires.
- `fps=30`: going from 60 to 30 frames is invisible in a background video and halves the size.
- `-crf 28`: the quality knob. A larger number means a smaller file and lower quality; 28 is fine for a background.
- `-pix_fmt yuv420p`: keeps it compatible with Safari and phones.
- `-movflags +faststart`: puts the index at the start of the file so the page can begin playback without downloading the whole thing.

### A GitHub contribution calendar

I also wanted a GitHub contribution calendar on the home page. The approach:

1. `tools/contributions.mjs` fetches GitHub's public contribution data and saves it as `source/_data/contributions.json`.
2. `scripts/contributions.js` draws the data as an inline SVG while the home page is built, and inserts it below the article list. I used an inline SVG rather than an image so the colors can follow dark mode.
3. A schedule in `pages.yml` rebuilds the site once a day, so the calendar updates itself:

```yaml
on:
  schedule:
    - cron: "0 0 * * *"
  workflow_dispatch:
```

If the fetch fails, the script only prints a warning and keeps the old data, so it never breaks the whole blog build.

## 5. My Writing Workflow

Writing a new post now goes like this:

```bash
git pull
hexo new "Post title"
hexo server
git add .
git commit -m "New post: Post title"
git push
```

The rule for syncing across several computers: **pull before you start, push when you finish.** On another computer, the first time:

```bash
git clone <repository-url>
cd <username>.github.io
npm install
```

## Wrap-up and What's Next

Looking back, the biggest gain was understanding the "why", not just the "how": why `.gitignore` can't manage files that are already tracked, why theme settings belong at the project root, why a proxy can break SSH. Once those are clear, I know where to look the next time something similar happens.

Next I plan to:

1. Build a separate personal résumé site, and point the blog's About link at it.
2. Set up my GitHub profile README, using an Action to read the blog's RSS and list the latest posts automatically.
3. After writing a few posts by hand, build an AI one-click publishing tool: give it key points and images, let a large language model turn them into Markdown, preview and confirm, then publish automatically.
4. Keep going with my *Dive into Deep Learning* notes, using the environment set up in this post.
