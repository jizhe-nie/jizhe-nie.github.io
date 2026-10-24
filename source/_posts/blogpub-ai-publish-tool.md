---
title: 我做了个 AI 一键发布博客的工具 blogpub
date: 2026-10-25 01:22:51
post_lang: zh
translation: blogpub-ai-publish-tool-en
categories:
- 开发笔记
tags:
- Hexo
- AI
- Python
- pytest
- blogpub
---

我的博客用 Hexo 加 Redefine 主题，博客和简历站都是中英双语的。每发一篇文章都要手动做一长串事：写 Markdown 和 front-matter、压缩图片、再写一遍英文版、本地预览、git 提交推送，还要往建站时间线里补一条记录。我想只把大致的内容和图片交给一个工具，它整理成文章，我预览确认后一条命令发布。这个工具就是 blogpub，已经开源在 https://github.com/jizhe-nie/blogpub 。需求 and 设计思路是我出的，和 Claude（AI 编程助手）一起一步步做出来，每一步都在自己的电脑上运行和验证。

<!-- more -->

## 它做什么

输入是一份粗略的笔记（Markdown 文件，或者命令行里直接写一段文字），加上若干图片。输出是中文版和英文版两篇草稿，放在博客的 `source/_drafts` 目录，图片放在 `source/images/posts/文章名/` 目录。

完整流程是四条命令：

- `blogpub new notes.md -i shots/`：用笔记和图片生成草稿
- `blogpub preview`：在浏览器里预览（`hexo server` 带上草稿）
- `blogpub publish 文章名`：确认后把草稿移到 `source/_posts`，提交并推送
- 推送后 GitHub Actions 自动部署博客

中英文两篇文章通过 front-matter 里的 `post_lang` 和 `translation` 两个字段互相关联，和我博客现有的双语机制一致。

## 支持哪些模型

不绑定某一家模型。支持 ChatGPT（OpenAI）、Claude、DeepSeek、Kimi、通义千问、本地的 Ollama，以及任何兼容 OpenAI 接口的服务。用 `blogpub providers` 命令可以列出它们。

![blogpub providers 命令的输出，列出支持的模型服务商](/images/posts/blogpub-ai-publish-tool/02-providers.png)

API Key 只通过环境变量提供，不写进任何文件；配置文件里如果出现 `api_key` 这样的字段会被直接拒绝。我自己目前用的是 DeepSeek，把 Key 存在 macOS 钥匙串里，再在 `~/.zshrc` 里用 `security find-generic-password` 读成环境变量。

DeepSeek 不能看图，所以我用它时要在笔记里说明每张图是什么，工具会按文件名把图片放到合适的位置；Claude 和 OpenAI 的模型可以直接看图。

## 我设计时特别在意的点

1. **隐私**。笔记发给模型之前，先扫描有没有 API Key、令牌、私钥、IP 地址、邮箱、手机号；发布之前再扫描一遍成品。发现密钥类内容会直接拦住。图片压缩的时候会清除 EXIF，包括 GPS 位置。
2. **不让模型乱编**。提示词里要求模型不得编造命令、数字、原因，缺信息的地方留下 TODO 注释。
3. **发布前必须预览**。文章先进 `_drafts` 草稿目录，我确认之后才会移到 `_posts`。
4. **发布时只暂存工具自己生成的文件**（文章、图片、时间线说明）。如果我还有别的已经暂存的改动，它会直接拒绝，避免误提交。
5. **时间线**。发布文章时，会在同一个提交里往博客的建站时间线说明文件追加一条记录。键写成 `post:文章名`，而不是提交哈希，因为写入记录的时候提交还没有产生，哈希还不存在。

![博客的建站时间线页面，发布文章时工具会往里追加一条记录](/images/posts/blogpub-ai-publish-tool/04-timeline.png)

## 实际做和用的过程中踩的坑

### 1. 一句话的笔记，模型自己补成了一整篇教程

我第一次试跑只给了一句话，模型编出了“我比较熟 Hexo”这样的理由，还写了一条错误的命令（`git clone` 主题仓库），而我实际是用 `npm install hexo-theme-redefine` 安装的。原因是笔记太空，模型就自己补全。解决：加强提示词，要求文章长度和笔记成比例，不要补充笔记里没有的步骤和理由；再加一个警告，文章比笔记长很多时提醒我仔细核对；缺信息的地方留 TODO，并统计 TODO 的数量。重新试跑后，同样的一句话只生成了一两段短文，并且在缺信息的地方留了 TODO。教训是笔记里的事实越具体，文章越准。

### 2. 测试在开发环境里通过，在我自己的终端里却失败了

我运行 `pytest` 时有两项失败，报 `KeyError`。排查时先复现问题：做一个会把请求头改成首字母大写的假代理，设置代理变量但不设 `NO_PROXY`，得到了同样的报错。原因是终端设置了代理却没有把本机地址排除，本机测试服务器的请求被代理转发了一圈，代理把 `authorization` 改成了 `Authorization`，而测试用了区分大小写的查找。HTTP 请求头名本身不区分大小写，真实调用不受影响。修复有两处：测试里统一按小写比较、并且不受外部代理设置影响；工具本身改成访问 `localhost` 和 `127.0.0.1` 时一律不走代理，这样以后用本地的 Ollama 也不会被代理影响。

### 3. 在主目录而不是博客目录里运行

报“这不像一个 Hexo 博客”。原因是工具只在当前目录找 `blogpub.yml`。解决：像 git 一样往上级目录查找配置文件，并且报错信息里明确告诉用户要先进入博客目录，或者用 `--blog` 指定。

### 4. 给模型看的已有分类和标签中英文混在一起

英文文章可能误用中文分类。解决：按语言分开列出。

### 5. `--slug` 选项原来没有校验

传入 `../etc` 这样的值可能让文件写到博客目录外面。写文档的时候发现，现在只允许小写字母、数字和连字符。

### 6. 配置钥匙串时把真实的 Key 写到了命令里“服务名”的位置

导致它明文出现在命令行和聊天记录里。教训：`security` 命令里 `-s` 后面是自己起的名字，Key 只能在后面弹出的密码提示里输入；一旦输错位置，必须立刻去服务商后台作废这个 Key 再重建。

### 7. 文档和命令行选项容易不同步

解决：写了一个测试，要求每个命令、每个选项、每个配置项都必须出现在中英文两份文档里。我故意删掉一个选项验证过，测试会立刻报错。

## 怎么安装和使用

安装（需要 Python 3.9 以上）：

```bash
git clone https://github.com/jizhe-nie/blogpub.git
cd blogpub
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

在博客目录里放一个 `blogpub.yml`，里面写 `provider`（用哪家模型）、`languages`（要写哪些语言）、`timeline_notes`（时间线说明文件路径）和 `style_notes`（文风要求）。Key 通过环境变量提供，例如 `DEEPSEEK_API_KEY`。

必须先进入博客目录再运行 blogpub，第一次可以加 `--dry-run`，只看结果不写任何文件。

![试运行（dry-run）生成草稿时终端的输出](/images/posts/blogpub-ai-publish-tool/01-dry-run.png)

## 怎么测试的

用 pytest 写了 57 项自动测试，运行一次大约 6 秒。测试覆盖：密钥扫描、图片处理（包括确认 GPS 被清除）、模型回复的校验和重试、文章和 front-matter 的生成、git 提交只包含自己生成的文件、文档和命令行同步。

![57 项测试全部通过的截图](/images/posts/blogpub-ai-publish-tool/03-tests.png)

各家模型接口的测试，是对一个本地启动的假服务器发真实的 HTTP 请求，所以不需要任何 API Key 就能验证请求格式。仓库的 GitHub Actions 每次推送都会在 Python 3.9、3.11、3.12 上跑一遍。

需要说明：目前只有 DeepSeek 用真实的 API 跑通过；其他服务商是按官方文档写的请求格式，只用假服务器验证过通信。

## 还没做、接下来想做的

- 用其他服务商的真实 Key 各试一次。
- 发布之后自动检查线上网站是否已经生效。
- 校验文章里的代码块。
- 发布到 PyPI，让别人可以直接 `pip install`。
