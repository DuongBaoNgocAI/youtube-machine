# YouTube Machine

**A start-to-finish workflow for building a YouTube channel, from zero to a published video, run by an AI assistant on your own computer.**

Version 1.1.0 · Published by AI CỘNG VN · [Tiếng Việt](README.md)

YouTube Machine is a set of 28 skills for AI coding assistants that run on your machine. It works best with Claude Code. The skills take you through every step, from picking a niche to publishing a video and learning from real analytics. Before each step, the assistant asks you a few questions, so the channel ends up reflecting your own choices. Everything is saved in a per-channel folder, so you can pick up where you left off at any time.

> The skill content is served from a server through the **YTM Gateway** (Cổng YTM). This repository contains only the framework, tools and templates. To use it, you sign in with the Gmail account registered for YouTube Machine.
>
> The assistant talks to you in Vietnamese. Content for your audience is written in your channel's language.

---

## Features

### Channel setup (done once)

| Step | What it does | Skill |
|---|---|---|
| 0 | Checks your hardware and suggests editing in Blender or CapCut | `youtube-machine` |
| 1 | Picks a niche and target audience, scoring each option | `yt-01-niche` |
| 2 | Researches 5–10 competitor channels: what works and what gaps are left | `yt-02-competitor-research` |
| 3 | Finds keywords and rising topics (search suggestions, Google Trends, top titles) | `yt-03-keyword-research` |
| 4 | Builds the brand kit: channel name, handle, SEO description, tags, voice, colors | `yt-04-brand` |
| 4b | Sets a fixed visual style, style lock, character rules and test images | `yt-04b-visual-style` |
| 5 | Gives a channel creation and settings checklist with ready-to-paste text | `yt-05-channel-setup` |
| 6 | Plans the first 30 video ideas and an 8–12 week posting schedule | `yt-06-content-plan` |
| 6b | Reviews policy, music and image copyright, and AI content disclosure | `yt-06b-policy-check` |

### Per video (repeated)

| Step | What it does | Skill |
|---|---|---|
| 6c | Checks demand and locks the title and thumbnail before writing | `yt-06c-demand-check` |
| 7 | Writes a retention-focused script and a clean voice-over file | `yt-07-script` |
| 7b | Produces an AI voice (ElevenLabs), corrected SRT subtitles and chapters | `yt-07b-voice-srt` |
| 7c | Turns each SRT line into a shot with image prompts and consistent characters | `yt-07c-shotlist` |
| 7d | Plans the edit for retention: pacing, twists, music by act | `yt-07d-edit-plan` |
| 7e | Renders the actual video in Blender (automated) or CapCut (manual) | `yt-07e-render` |
| 7m | Creates motion graphics: kinetic type, maps, timelines, counters, diagrams | `yt-07m-motion` |
| Shoot | Plans live-action shoots: teleprompter text, B-roll | `yt-07q-quay` |
| Cut | Edits by transcript, removing bad takes, silences and filler words | `yt-07f-cat-theo-chu` |
| Review | Runs technical checks and verifies the video keeps its promise before publishing | `yt-07x-soat` |
| Shorts | Picks standalone moments, crops them vertical and adds subtitles | `yt-07r-shorts` |
| 7k | Builds videos in WebGL with no image credits: 10 block styles (vertical) and 6 acting styles (16:9 or vertical) | `yt-07k-khoi-vuong` |
| Thumbnail | Places text correctly and checks it at small size | `yt-08t-thumbnail` |
| 8 | Builds the SEO pack: 5 titles, description, chapters, tags, upload checklist | `yt-08-seo-publish` |
| 9 | Covers the first 48 hours after publishing and what to do when views are low | `yt-09-post-publish` |
| 10 | Learns from real analytics and adjusts the next video | `yt-10-learning` |

### Support skills

| Skill | What it does |
|---|---|
| `yt-00-folders` | Creates, checks and cleans channel and video folders, and reports disk usage |
| `yt-osint` | Finds open sources, fact-checks claims and locates original material |
| `yt-mo-xe-dung` | Breaks down how a competitor edits a video (cut rhythm, on-screen text, sound) from a link |

### What makes it different

- **Asks before acting.** Each step opens with 2–5 questions that change the result, each with a suggested answer. Questions the assistant already knows the answer to are skipped.
- **Checks demand before effort.** No script gets written until there is a clickable title and thumbnail, and some evidence that people watch the topic.
- **Avoids repeating itself.** There are 16 format recipes (voice-first, visual-first, shoot-first, screen recording, music, data, existing footage…). Every video goes through five value gates. `node tools/chong-lap.mjs` compares a new script against earlier ones.
- **Learns from each channel.** Real numbers go into `learnings.md`, and every later step reads that file first.
- **Visual reports.** At each decision point, the assistant writes a short HTML page with option cards and data tables.
- **Multiple channels.** Each channel has its own folder under `channels/`, with its own progress.

---

## Requirements

- Windows 10 or 11. macOS and Linux work partially.
- [Node.js](https://nodejs.org) (LTS).
- Claude Code, or the Claude desktop app (Code tab). Gemini CLI, Google Antigravity and Codex can read the skills, but YTM Gateway setup for them is coming in a later release.
- An internet connection and a Gmail account registered for YouTube Machine.
- Plenty of free disk space. Each video typically takes 1–4 GB.

## Installation

**Option 1: git**

```powershell
git clone https://github.com/DuongBaoNgocAI/youtube-machine.git D:\YoutubeMachine
```

**Option 2: zip.** Click **Code → Download ZIP** on this page and extract it to a short path without special characters, for example `D:\YoutubeMachine`.

Then open the folder in Claude Code (or set it as the working folder in the Claude app's Code tab). When asked whether to use the `ytm` MCP server, approve it. If you are not asked, run this in the folder and restart Claude:

```powershell
claude mcp add ytm -- node tools/ytm-cong.mjs
```

## Usage

Open the assistant in the folder and say what you want in plain words:

| You say | The assistant |
|---|---|
| "Tôi muốn xây kênh YouTube mới" (I want to build a new channel) | Checks your machine, asks a few questions, then starts from step 1 |
| "Tiếp tục kênh <name>" (Continue channel <name>) | Reads the channel's progress and does the next step |
| "Viết kịch bản video số 4 cho kênh <name>" (Write the script for video 4) | Jumps straight to that step |
| "Làm motion cho đoạn này" (Make motion graphics for this part) | Builds motion graphics with HyperFrames |
| "Phân tích cách dựng video <link>" (Break down how this video is edited) | Analyzes the cut rhythm and structure |

**The first time on each computer**, the assistant opens your browser to a Google account picker. Choose the registered Gmail account, and when the browser says you are signed in, go back to the assistant. There is no code to type, and the assistant never sees your password. Each account works on up to 2 computers. To switch computers, remove the old one on the YouTube Machine page.

## Companion tools

You don't need to install everything up front. The assistant tells you what each step needs when you get there.

| Tool | Used for |
|---|---|
| ElevenLabs or another voice tool | Voice-over and SRT subtitles |
| [Flow AIC](https://github.com/DuongBaoNgocAI/flow-aic-releases/releases/latest) | Batch image and clip generation. Without it, the skills give you prompts to use elsewhere |
| Blender 5.x + ffmpeg | Automated editing |
| CapCut | Manual editing, suited to lower-end machines |
| HyperFrames + ffmpeg | Motion graphics, fetched via `npx` on demand |

Run `node tools/do-may.mjs` to see whether your machine suits the Blender or the CapCut route.

## Updating

When a new version is out, the assistant tells you at the start of a session. Just say "update YouTube Machine".

- The assistant runs `node tools/cap-nhat.mjs`, downloads the version your account is entitled to, and replaces the toolkit files. Your `channels/` folder is kept.
- Replaced files are moved to `_thung-rac/cap-nhat-<old>-sang-<new>-<time>/`. Delete them yourself when you no longer need them.
- Already downloaded the zip from the YouTube Machine page? Say "update YouTube Machine from the zip file" with its path.
- Version 1.0.0 has no update command. For the first update, download the zip from the Downloads section and copy it over your folder. After that, just ask the assistant.

Your channel data in `channels/` is listed in `.gitignore` and is never committed. The change log is in [CHANGELOG.md](CHANGELOG.md).

## Support

Zalo group: https://zalo.me/g/yenkqg494

Terms of use: [LICENSE.txt](LICENSE.txt).
