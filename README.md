# catch-me-up

A Claude Code mod that shows a live catch-up summary of the current session in a side pane. It is the `/what` summary, kept up to date as the session goes on: why the session started, what was done, what came out of it, where things stand, and what needs you.

Requires Claude Code 2.1.287 or later. Tested with 2.1.287 and 2.1.288.

## How it works

- **When it updates.** After each turn of the main conversation that used at least one tool, such as a command, an edit, a file read, a search or an MCP call. Turns that are only chat are not summarized on their own; their messages are folded in at the next update. Subagent turns are skipped, and nothing runs in `claude -p`, where no app shows the pane.
- **How it updates.** A rolling update with Haiku. Each call gets the previous summary, the messages added since then (long texts and tool results are clipped), and the output of `git status --short`, `git diff --stat`, and `git log --oneline -n 5`. Haiku writes the full new summary. A long backlog, such as after Rebuild, is folded in over several calls of about 100,000 characters each.
- **What it writes.** It follows [INSTRUCTIONS.md](INSTRUCTIONS.md), the instructions of the `/what` skill, plus a few rules for the narrow pane: at most 4 short bullets per section.
- **Cost.** One Haiku call per update, on your plan or API key.
- **Storage.** Each session's summary is kept in the mod's store, so it is still there after a restart or `/resume`. The store keeps the 100 most recent sessions.

## What it runs and sends

- **Runs** `git status --short`, `git diff --stat` and `git log --oneline -n 5` in the session's working directory before each update.
- **Sends** the previous summary, the new transcript messages (your prompts, Claude's replies, and tool calls with clipped results) and that git output to Claude Haiku, through Claude Code's own model API with your session's credentials. Nothing is sent anywhere else.
- **Stores** each session's summary on your machine, in the mod's store under `~/.claude/plugins/store/`.

## The pane

- Opens by itself when a session starts. In the terminal it only appears when the window is at least 144 columns wide (110 once you have opened it yourself); run `/catch-me-up` to open it at any width.
- **Refresh** (`r`): fold in what is new now, even if no tool was used.
- **Rebuild** (`b`): throw the summary away and summarize the session again from the start. Claude Code shows a mod at most the newest 4,096 messages. Does nothing while an update is running.
- A failed update shows its reason in place of the time of the last update.

## Install

```bash
claude plugin marketplace add oliverow/catch-me-up
```

```bash
claude plugin install catch-me-up@catch-me-up
```

To try it for one session from a clone:

```bash
claude --plugin-dir ./catch-me-up
```
