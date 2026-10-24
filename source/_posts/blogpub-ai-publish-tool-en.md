---
title: 'I Built blogpub: A One-Command AI Publishing Tool for My Blog'
date: 2026-10-25 01:22:51
post_lang: en
translation: blogpub-ai-publish-tool
categories:
- Dev Notes
tags:
- Hexo
- AI
- Python
- pytest
- blogpub
---

My blog runs on Hexo with the Redefine theme, and both the blog and my resume site are bilingual. Every post meant a long manual checklist: write the Markdown and front-matter, compress images, write the English version again, preview locally, git commit and push, and add an entry to the site timeline. I wanted to hand a rough note and some images to a tool, have it turn them into a post, review the result, and publish with one command. That tool is blogpub, now open source at https://github.com/jizhe-nie/blogpub . I came up with the requirements and design, and built it step by step with Claude (an AI coding assistant), running and verifying every step on my own machine.

<!-- more -->

## What it does

Input: a rough note (a Markdown file, or a paragraph typed on the command line) plus some images. Output: a Chinese draft and an English draft in the blog's `source/_drafts` directory, with images under `source/images/posts/<post-name>/`.

The whole flow is four commands:

- `blogpub new notes.md -i shots/`: generate drafts from the note and images
- `blogpub preview`: preview in the browser (`hexo server` with drafts)
- `blogpub publish <post-name>`: after review, move the drafts to `source/_posts`, commit and push
- After the push, GitHub Actions deploys the blog

The two language versions are linked through the `post_lang` and `translation` fields in front-matter, matching the bilingual mechanism my blog already uses.

## Which models it supports

It is not tied to one provider. It supports ChatGPT (OpenAI), Claude, DeepSeek, Kimi, Qwen, local Ollama, and any service compatible with the OpenAI API. The `blogpub providers` command lists them.

![Output of the blogpub providers command, listing the supported model providers](/images/posts/blogpub-ai-publish-tool/02-providers.png)

API keys are provided only through environment variables and never written to any file; a config file containing a field like `api_key` is rejected outright. I currently use DeepSeek, storing the key in the macOS Keychain and reading it into an environment variable in `~/.zshrc` via `security find-generic-password`.

DeepSeek cannot see images, so when I use it I describe each image in the note and the tool places them by file name; Claude and OpenAI models can see images directly.

## What I cared about in the design

1. **Privacy.** Before a note is sent to the model, it is scanned for API keys, tokens, private keys, IP addresses, emails and phone numbers; the finished post is scanned again before publishing. Key-like content is blocked outright. Image compression strips EXIF, including GPS location.
2. **Don't let the model make things up.** The prompt requires the model not to invent commands, numbers or reasons, and to leave TODO comments where information is missing.
3. **Always preview before publishing.** Posts land in the `_drafts` directory first and only move to `_posts` after I confirm.
4. **Only stage files the tool generated** (posts, images, timeline note). If I have other staged changes, it refuses outright, to avoid accidental commits.
5. **Timeline.** When publishing, it appends an entry to the site timeline note in the same commit. The key is `post:<post-name>` rather than the commit hash, because at the time the entry is written the commit does not exist yet and there is no hash.

![The site timeline page on my blog, where the tool appends an entry when publishing](/images/posts/blogpub-ai-publish-tool/04-timeline.png)

## Pitfalls from building and using it

### 1. A one-sentence note turned into a full tutorial

On my first trial run I gave it a single sentence. The model invented a reason like "I'm fairly familiar with Hexo" and a wrong command (`git clone` of the theme repo), whereas I actually installed it with `npm install hexo-theme-redefine`. The cause: the note was too sparse, so the model filled in the gaps. Fix: strengthen the prompt to require post length proportional to the note, and to not add steps or reasons that aren't in the note; add a warning when the post is much longer than the note so I check it carefully; leave TODOs where information is missing and count them. After re-running, the same one sentence produced only one or two short paragraphs, with TODOs where information was missing. The lesson: the more concrete the facts in the note, the more accurate the post.

### 2. Tests passed in the dev environment but failed in my own terminal

Running `pytest` gave two failures with `KeyError`. I reproduced it first: a fake proxy that capitalizes request header names, with proxy variables set but no `NO_PROXY`, produced the same error. The cause: my terminal had a proxy set without excluding local addresses, so requests to the local test server went through the proxy, which changed `authorization` to `Authorization`, and the test did a case-sensitive lookup. HTTP header names are case-insensitive, so real calls were unaffected. Two fixes: tests now compare lowercase and are isolated from external proxy settings; the tool now bypasses proxies for `localhost` and `127.0.0.1`, so local Ollama won't be affected by a proxy either.

### 3. Running from the home directory instead of the blog directory

It reported "this doesn't look like a Hexo blog", because the tool only looked for `blogpub.yml` in the current directory. Fix: walk up parent directories for the config file like git does, and make the error message say clearly that the user should enter the blog directory first or pass `--blog`.

### 4. Existing categories and tags shown to the model mixed Chinese and English

English posts could pick Chinese categories. Fix: list them per language.

### 5. The `--slug` option had no validation

A value like `../etc` could write files outside the blog directory. I found this while writing the docs; now it only allows lowercase letters, digits and hyphens.

### 6. When setting up the Keychain I put the real key where the command expects the "service name"

So it appeared in plain text in the terminal and in chat logs. Lesson: in the `security` command, `-s` takes a name you choose, and the key should only be entered in the password prompt that follows; if you put it in the wrong place, revoke the key in the provider's console immediately and create a new one.

### 7. Docs and CLI options drift out of sync easily

Fix: a test that requires every command, option and config field to appear in both the Chinese and English docs. I deleted an option on purpose to verify it, and the test failed immediately.

## Installing and using it

Install (requires Python 3.9+):

```bash
git clone https://github.com/jizhe-nie/blogpub.git
cd blogpub
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

Put a `blogpub.yml` in the blog directory with `provider` (which model service), `languages` (which languages to write), `timeline_notes` (path to the timeline note) and `style_notes` (style requirements). The key comes from an environment variable, e.g. `DEEPSEEK_API_KEY`.

You must enter the blog directory before running blogpub. The first time, add `--dry-run` to see the result without writing any files.

![Terminal output from a dry run generating drafts](/images/posts/blogpub-ai-publish-tool/01-dry-run.png)

## How it's tested

I wrote 57 automated tests with pytest; a run takes about 6 seconds. They cover: secret scanning, image handling (including confirming GPS is stripped), validation and retry of model replies, post and front-matter generation, git commits containing only the tool's own files, and docs/CLI sync.

![Screenshot of all 57 tests passing](/images/posts/blogpub-ai-publish-tool/03-tests.png)

The provider interface tests send real HTTP requests to a fake server started locally, so request formats can be verified without any API key. GitHub Actions runs them on every push against Python 3.9, 3.11 and 3.12.

One caveat: so far only DeepSeek has been run against the real API; the other providers' request formats are written from their official docs and have only been verified against the fake server.

## Not done yet, and what's next

- Try each of the other providers once with a real key.
- Automatically check that the live site has picked up a post after publishing.
- Validate code blocks in posts.
- Publish to PyPI so others can `pip install` it.
