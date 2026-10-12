import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE = { component: 'Pane', requestId: 'catch-me-up', props: { title: 'Catch me up' } } as const

// Answers every call an update makes, and records the system prompt each
// model call was given.
function stubUpdate(on: On, systemPrompts: string[]) {
  mock.store(on)
  mock.clock(on)
  on('session.messages', () => ({ value: [{ role: 'user', text: 'Fix the login bug', toolUses: [] }] }))
  on('fs.read', () => ({ value: '# Session catch-up — instructions' }))
  on('process.run', () => ({
    value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('model.complete', ($, e) => {
    systemPrompts.push(e.system ?? '')
    return { value: { isAnswered: true, text: '## Why this session\n- a bug', usage: { input_tokens: 1, output_tokens: 1 } } }
  })
}

describe('summary language', () => {
  for (const [language, refreshLabel] of [
    ['English', 'Refresh'],
    ['German', 'Aktualisieren'],
    ['Russian', 'Обновить'],
  ] as const) {
    test(`${language}: the model is told to write in it, and the pane's labels are in it`, { options: { language } }, async ($, on) => {
      const systemPrompts: string[] = []
      stubUpdate(on, systemPrompts)
      const ui = await $.ui.mount({ plugin: 'catch-me-up', surface: 'terminal', ...PANE })

      expect((await ui.find({ key: 'refresh' }))?.props.label).toBe(refreshLabel)

      await ui.press({ key: 'refresh' })
      expect(systemPrompts.length).toBe(1)
      expect(systemPrompts[0]).toContain(`in ${language}`)
      await ui.unmount()
    })
  }

  test('no language set: English, as before the setting existed', async ($, on) => {
    const systemPrompts: string[] = []
    stubUpdate(on, systemPrompts)
    const ui = await $.ui.mount({ plugin: 'catch-me-up', surface: 'terminal', ...PANE })

    expect((await ui.find({ key: 'refresh' }))?.props.label).toBe('Refresh')
    await ui.press({ key: 'refresh' })
    expect(systemPrompts[0]).toContain('in English')
    await ui.unmount()
  })
})
