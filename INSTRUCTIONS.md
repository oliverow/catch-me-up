# Session catch-up — instructions

What to write in a catch-up summary of a Claude Code session, and how.
catch-me-up sends these instructions to the model that keeps its pane up to
date.

## Who you are writing for

Someone who has been away for days and is reading this session cold. Assume they
have forgotten the goal, never saw the intermediate steps, and have no memory of
any shorthand invented along the way. Write the way you would brief a sharp
colleague who just walked in: they follow technical detail fine, they simply
don't know what happened here.

The test for a good summary: they could pick the work back up from your text
alone, without scrolling through the transcript.

## What to read first

**The whole conversation, from the first message.** The opening request usually
holds the "why", and it's the part most likely to be forgotten. Later messages
often redirect the goal — catch those turns, because the session's real purpose
may not be its original one.

**The working tree, to check your own claims.** Discussion of an edit is not
proof it landed; it may have failed, been reverted, or been replaced by a later
change. Before reporting work as done, confirm it:

```
git status --short
git diff --stat
git log --oneline -n 5
```

Report what survives on disk. If the session says a file was created and it
isn't there, say so — that gap is exactly what the reader needs and would never
catch on their own. If the session touched more than one repository, check each;
if it touched none, skip this and don't imply otherwise.

**Anything still running.** Background jobs, training runs, open processes: if
the session started something, its state belongs in the summary.

Stop there. Don't go spelunking through Notion, the devlog, or project history
unless the session itself was working with them — this is a recap of *this
session*, and outside material tends to drag in stale claims that contradict
what actually happened here.

## Name things, every time

Sessions invent names. "R5", "the second arm", "Gate 3", "option (iii)" — each
made perfect sense in the moment and means nothing a week later. A summary full
of them is worse than no summary, because the reader can't even tell what they
don't know.

- Weak: "R5 beat R3 by 2 points."
- Good: "The model fine-tuned with the detector hint switched on scored 2 points
  above the plain baseline."

- Weak: "Gate 3 is still failing."
- Good: "The third check in the release script — the one that verifies the
  migration applied cleanly — is still failing."

Do this on every mention, not only the first, and do it even for ids the
project's own documents define: write "the hooked-beak rule" rather than a bare
"R1", putting the id in parentheses only where it's needed to look something up.
Defining a name once and then falling back to the bare form looks tidy but hands
the reader a mapping to memorize while they read.

An abbreviation that exists outside this session is different — a few words of
explanation the first time, then it can stand on its own.

## Five sections

Use these exact headings.

1. **`## Why this session`** — what was asked for and the problem sitting behind
   it. Two or three sentences. If the goal shifted partway through, say what it
   started as and what it became.

2. **`## What I did`** — the concrete actions: files created, edited or deleted,
   with paths; commands and experiments run; things installed, configured or
   thrown away. This is the section that lets the reader retrace your steps or
   undo them, so favour specifics — a path they can open beats a description of
   the kind of work it was. "Looked into the config" tells them nothing;
   "rewrote the retry block in `fetch.py` to back off exponentially" tells them
   where to look. Group trivial steps together rather than listing every command.

3. **`## What came out of it`** — findings, decisions, conclusions: what the
   reader can act on or reason with, not the steps that got there, which are in
   section 2. Give the result rather than the effort — "the hints gave no
   benefit, best case +0.13, which isn't meaningful" beats "I ran several
   experiments on hint quality". Dead ends belong here too, stated as results:
   "caching the embeddings didn't help, the bottleneck is the network call"
   saves the reader from trying it again.

4. **`## Where things stand`** — the state of the world right now. What's
   finished, what's half-done, what's broken, what's uncommitted, what's still
   running. Be concrete about the difference between "written" and "applied",
   and between "passes locally" and "shipped".

5. **`## What's next / needs you`** — open questions, pending decisions, and the
   obvious next step. Anything blocked on the user goes here, stated as a
   question they can answer. If nothing is pending, one line saying so beats
   inventing work.

Sections 2, 3 and 4 answer different questions: what was touched, what was
learned, what is true now. If a bullet wants to appear in two of them, the
action goes in 2, its consequence in 3, and only the unfinished or surprising
part in 4.

## Length

Scale to the session. A thirty-message debugging session might be fifteen lines;
a long research session might be forty. Never pad to fill a section.

Be straight about failure. If something is broken, abandoned, or unresolved, the
reader needs that more than they need the wins. If the session accomplished very
little, one honest line beats five inflated sections.
