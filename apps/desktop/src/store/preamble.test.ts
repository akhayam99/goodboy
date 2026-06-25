import { describe, expect, it } from 'vitest'
import type { ContextSlot, IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types'
import { buildContextPreamble, buildPriorTurnsBlock, getModelContextWindow } from './preamble'

const NOW = '2026-05-11T00:00:00.000Z' as IsoDateTime
const RUN = 'run-1' as ProviderRunId

function slot(key: string, value: string): ContextSlot {
  return { key, value, enabled: true }
}

describe('buildContextPreamble', () => {
  it('emits marker hint even with no slots', () => {
    const out = buildContextPreamble([])
    expect(out).toContain('context handoff protocol')
    expect(out).not.toContain('## shared context')
  })

  it('renders shared context block when slots present', () => {
    const out = buildContextPreamble([slot('goal', 'ship m4-m6')])
    expect(out).toContain('## shared context')
    expect(out).toContain('ship m4-m6')
  })

  it('slotFilter drops slots not in allow-list', () => {
    const slots = [slot('goal', 'g'), slot('files_touched', 'a.ts'), slot('decisions', 'd')]
    const out = buildContextPreamble(slots, ['goal', 'decisions'])
    expect(out).toContain('goal')
    expect(out).toContain('## decisions')
    expect(out).not.toContain('a.ts')
  })

  it('empty filter result → no shared context block', () => {
    const out = buildContextPreamble([slot('open_questions', 'q?')], ['goal'])
    expect(out).not.toContain('## shared context')
    expect(out).toContain('context handoff protocol')
  })
})

describe('buildPriorTurnsBlock', () => {
  it('empty transcripts → empty string', () => {
    expect(buildPriorTurnsBlock([], 1000)).toBe('')
  })

  it('only tool events (no text) → empty string', () => {
    const events: TurnEvent[] = [
      {
        kind: 'tool_call_start',
        runId: RUN,
        toolUseId: 't1',
        toolName: 'Bash',
        input: {},
        at: NOW,
      },
    ]
    expect(buildPriorTurnsBlock(events, 1000)).toBe('')
  })

  it('groups assistant deltas, preserves chronological order', () => {
    const events: TurnEvent[] = [
      { kind: 'user_text', runId: RUN, text: 'hello', at: NOW },
      { kind: 'assistant_text', runId: RUN, delta: 'hi ', at: NOW },
      { kind: 'assistant_text', runId: RUN, delta: 'there', at: NOW },
      { kind: 'user_text', runId: RUN, text: 'bye', at: NOW },
    ]
    const out = buildPriorTurnsBlock(events, 1000)
    expect(out).toContain('prior turns')
    expect(out.indexOf('hello')).toBeLessThan(out.indexOf('hi there'))
    expect(out.indexOf('hi there')).toBeLessThan(out.indexOf('bye'))
  })

  it('drops oldest first when over budget', () => {
    const longText = 'x'.repeat(4000)
    const events: TurnEvent[] = [
      { kind: 'user_text', runId: RUN, text: `old-${longText}`, at: NOW },
      { kind: 'user_text', runId: RUN, text: `mid-${longText}`, at: NOW },
      { kind: 'user_text', runId: RUN, text: `new-${longText}`, at: NOW },
    ]
    const out = buildPriorTurnsBlock(events, 1500)
    expect(out).toContain('new-')
    expect(out).not.toContain('old-')
  })

  it('budget too small for any turn → empty', () => {
    const events: TurnEvent[] = [{ kind: 'user_text', runId: RUN, text: 'x'.repeat(4000), at: NOW }]
    expect(buildPriorTurnsBlock(events, 10)).toBe('')
  })
})

describe('getModelContextWindow', () => {
  it('known claude model → 1_000_000', () => {
    expect(getModelContextWindow('claude-opus-4-7')).toBe(1_000_000)
  })

  it('unknown model → null', () => {
    expect(getModelContextWindow('some-custom-model')).toBeNull()
  })
})
