// catch-me-up: a pane that keeps a live catch-up summary of the session.
// After each turn that used a tool, Haiku folds the messages added since the
// last update into the previous summary (a rolling update).

const PANE = 'catch-me-up'
const MODEL = 'haiku'
// About how many characters of new messages go to the model in one call. A
// longer backlog, such as after Rebuild, is folded in over several calls.
const CHUNK_CHARS = 100_000
// How many sessions' summaries the store keeps
const KEEP_SESSIONS = 100

// The current session's summary, how many transcript messages it covers, and
// a fingerprint of the last of them
let sessionId = ''
let summary = ''
let covered = 0
let marker = ''
let updatedAt = 0
let status = ''
let running = false
// The update asked for while one was running: null, or its onlyIfWork
let queued = null

// The language of the summary and the pane: the `language` option, else Claude
// Code's `language` setting, else English.
let language = 'English'
const isEnglish = (v) => /^(en([_-]|$)|english)/i.test(v.trim())
const isGerman = (v) => /^(de([_-]|$)|german|deutsch)/i.test(v.trim())

// The pane's own words. A language without a table here gets the English ones.
const STRINGS = {
  en: {
    title: 'Catch me up',
    command: 'Open the catch-me-up summary pane',
    refresh: 'Refresh',
    refreshKey: 'r',
    rebuild: 'Rebuild',
    rebuildKey: 'b',
    updated: 'Updated',
    none: 'No summary yet',
    updating: 'Updating…',
    failed: 'Update failed: ',
    empty: 'The summary appears after the first turn that uses a tool, or press Refresh.',
  },
  de: {
    title: 'Zusammenfassung',
    command: 'Öffnet das Panel mit der laufenden Zusammenfassung',
    refresh: 'Aktualisieren',
    refreshKey: 'a',
    rebuild: 'Neu aufbauen',
    rebuildKey: 'n',
    updated: 'Aktualisiert',
    none: 'Noch keine Zusammenfassung',
    updating: 'Wird aktualisiert …',
    failed: 'Aktualisierung fehlgeschlagen: ',
    empty: 'Die Zusammenfassung erscheint nach dem ersten Zug, der ein Werkzeug benutzt, oder mit Aktualisieren.',
  },
}
const tr = () => (isGerman(language) ? STRINGS.de : STRINGS.en)

// The five headings of INSTRUCTIONS.md, fixed per language so they read the same on every update
const HEADINGS = {
  de: ['Worum es geht', 'Was ich gemacht habe', 'Was dabei herauskam', 'Aktueller Stand', 'Als Nächstes / wartet auf dich'],
}

async function detectLanguage($, option) {
  const chosen = String(option ?? '').trim()
  if (chosen && chosen.toLowerCase() !== 'auto') return chosen
  try {
    const settings = await $.settings.read()
    if (typeof settings.language === 'string' && settings.language.trim()) return settings.language.trim()
  } catch {
    // No settings: English
  }
  return 'English'
}

// What the system prompt adds for a summary in another language than English
function languageRule() {
  if (isEnglish(language)) return ''
  if (isGerman(language)) {
    return (
      'Write the whole summary in German. Use these headings instead of the English ones in the instructions, in this order: ' +
      HEADINGS.de.map((h) => '"## ' + h + '"').join(', ') +
      '. Keep file names, paths, commands, code identifiers and proper names as they are.'
    )
  }
  return (
    'Write the whole summary in ' + language + ', the section headings translated too. ' +
    'Keep file names, paths, commands, code identifiers and proper names as they are.'
  )
}

async function load($) {
  sessionId = await $.session.id()
  const saved = await $.store.get('session:' + sessionId)
  summary = saved?.summary ?? ''
  covered = saved?.covered ?? 0
  marker = saved?.marker ?? ''
  updatedAt = saved?.updatedAt ?? 0
  status = ''
  $.ui.invalidate('ui.render')
}

async function save($) {
  await $.store.set('session:' + sessionId, { summary, covered, marker, updatedAt })
  // Most recent first; drop the summaries of the oldest sessions
  const order = [sessionId, ...((await $.store.get('order')) ?? []).filter((id) => id !== sessionId)]
  for (const id of order.slice(KEEP_SESSIONS)) await $.store.delete('session:' + id)
  await $.store.set('order', order.slice(0, KEEP_SESSIONS))
}

const fingerprint = (m) => m.role + '\n' + m.text.slice(0, 200) + '\n' + m.toolUses.map((t) => t.tool_use_id).join(',')

// Claude Code adds system reminders to user messages; they aren't the user's words
const unremind = (s) => s.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim()

const clip = (s, n) => (s.length > n ? s.slice(0, n) + ' […]' : s)

function formatMessage(m) {
  const lines = []
  const text = unremind(m.text)
  if (text) lines.push((m.role === 'user' ? 'USER: ' : 'ASSISTANT: ') + clip(text, 4000))
  for (const t of m.toolUses) {
    lines.push(`  [tool ${t.tool}] ${clip(JSON.stringify(t.input), 300)}` + (t.text ? ` → ${clip(t.text, 300)}` : ''))
  }
  return lines.join('\n')
}

async function gitState($) {
  const out = []
  for (const argv of [['git', 'status', '--short'], ['git', 'diff', '--stat'], ['git', 'log', '--oneline', '-n', '5']]) {
    const r = await $.process.run(argv)
    out.push('$ ' + argv.join(' ') + '\n' + ((r.exitCode ? r.stderr : r.stdout).trim() || '(empty)'))
  }
  return out.join('\n\n')
}

async function systemPrompt($) {
  const instructions = await $.fs.read($.plugin.root + '/INSTRUCTIONS.md')
  return [
    'You keep a live catch-up summary of a Claude Code session. It is shown in a narrow side pane and updated as the session goes on.',
    'Follow the instructions below for what to write and how. They were written for a one-off summary by an agent that reads the whole conversation and runs commands. You cannot. You get your previous summary, the messages added since it was written, and the current git state. Write the full updated summary: keep what is still true, rewrite what changed, drop what no longer matters. The previous summary is your only memory of earlier messages, so keep its facts unless the new messages change them.',
    'Put the weight on the high-level context, the motivation, a summary of the method, and the current progress.',
    'Format, overriding the instructions below: the pane is narrow, so every section is a list of "- " bullets, never a paragraph. At most 4 bullets per section, each one or two short lines. Output only the summary Markdown, starting with the first heading.',
    languageRule(),
    '<instructions>\n' + instructions + '\n</instructions>',
  ]
    .filter(Boolean)
    .join('\n\n')
}

// Fold the messages added since the last update into the summary.
// With onlyIfWork, skip when none of them used a tool.
async function update($, onlyIfWork) {
  if (running) {
    queued = (queued ?? true) && onlyIfWork
    return
  }
  running = true
  const id = sessionId
  try {
    const messages = await $.session.messages()
    // The summary normally ends at message `covered`. Past the newest 4096
    // messages the list slides, and compaction replaces it, so otherwise look
    // for the last message summarized, and start over when it is gone.
    let i =
      covered > 0 && covered <= messages.length && fingerprint(messages[covered - 1]) === marker
        ? covered
        : messages.findLastIndex((m) => fingerprint(m) === marker) + 1
    const fresh = messages.slice(i)
    if (!fresh.length) return
    if (onlyIfWork && !fresh.some((m) => m.toolUses.length)) return

    status = tr().updating
    $.ui.invalidate('ui.render')
    const system = await systemPrompt($)
    const git = await gitState($)

    while (i < messages.length) {
      let chunk = ''
      let end = i
      while (end < messages.length && (end === i || chunk.length < CHUNK_CHARS)) chunk += formatMessage(messages[end++]) + '\n\n'
      const r = await $.model.complete({
        model: MODEL,
        system,
        prompt:
          '<previous_summary>\n' + (summary || '(none yet)') + '\n</previous_summary>\n\n' +
          '<new_messages>\n' + chunk + '</new_messages>\n\n' +
          '<git_state>\n' + git + '\n</git_state>',
        maxTokens: 3000,
      })
      if (!r.isAnswered) throw new Error(r.reason + (r.error ? ` (${r.error})` : ''))
      // /clear, /resume or /branch switched sessions while the model ran
      if (sessionId !== id) return
      summary = r.text.trim().slice(0, 10_000)
      covered = i = end
      marker = fingerprint(messages[end - 1])
      updatedAt = await $.clock.now()
      await save($)
      $.ui.invalidate('ui.render')
    }
    status = ''
  } catch (err) {
    status = tr().failed + err.message
  } finally {
    running = false
    $.ui.invalidate('ui.render')
    if (queued !== null) {
      const onlyIfWorkNext = queued
      queued = null
      update($, onlyIfWorkNext)
    }
  }
}

export function register(on, options) {
  on('session.start', async ($, e, next) => {
    language = await detectLanguage($, options?.language)
    await load($)
    await $.command.register({ name: 'catch-me-up', description: tr().command, immediate: true })
    // Opened without being asked: the terminal places it only when wide enough
    await $.ui.open({ id: PANE, title: tr().title })
    return next(e)
  })

  // /clear, /resume and /branch switch to another session's summary
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await load($)
    return next(e)
  })

  on('command.run', { command: 'catch-me-up' }, async ($) => {
    await $.ui.open({ id: PANE, title: tr().title })
    return {}
  })

  on('turn.complete', async ($, e, next) => {
    // No app shows the pane in a claude -p run. Not awaited, so the turn ends
    // without waiting for the summary.
    if (!e.agentId && (await $.session.surfaces()).length) update($, true)
    return next(e)
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const s = tr()
    const d = new Date(updatedAt)
    const when = updatedAt ? `${s.updated} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : s.none
    return Box({
      flexDirection: 'column',
      children: [
        Box({
          flexDirection: 'row',
          columnGap: 2,
          children: [
            Button({ key: 'refresh', label: s.refresh, hotkey: s.refreshKey, plain: true, onPress: () => update($, false) }),
            Button({
              key: 'rebuild',
              label: s.rebuild,
              hotkey: s.rebuildKey,
              plain: true,
              onPress: () => {
                if (running) return
                summary = ''
                covered = 0
                marker = ''
                update($, false)
              },
            }),
            Text({ dimColor: true, children: [status || when] }),
          ],
        }),
        Text({ children: [' '] }),
        summary
          ? Markdown({ key: 'summary', text: summary })
          : Text({ dimColor: true, children: [s.empty] }),
      ],
    })
  })
}
