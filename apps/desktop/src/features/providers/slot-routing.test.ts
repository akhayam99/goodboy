import { describe, expect, it } from 'vitest'
import { SLOT_KEYS } from '@goodboy/core'
import { AGENT_KIND_SLOTS, slotsForKind } from './slot-routing'

describe('AGENT_KIND_SLOTS', () => {
  it('only references valid slot keys', () => {
    const valid = new Set<string>(SLOT_KEYS)
    for (const [, slots] of Object.entries(AGENT_KIND_SLOTS)) {
      if (!slots) {
        continue
      }
      for (const k of slots) expect(valid.has(k)).toBe(true)
    }
  })

  it('planner drops files_touched', () => {
    expect(AGENT_KIND_SLOTS.planner).toBeDefined()
    expect(AGENT_KIND_SLOTS.planner).not.toContain('files_touched')
  })

  it('debugger drops open_questions', () => {
    expect(AGENT_KIND_SLOTS.debugger).toBeDefined()
    expect(AGENT_KIND_SLOTS.debugger).not.toContain('open_questions')
  })

  it('generic has no entry → fallback (all slots)', () => {
    expect(slotsForKind('generic')).toBeUndefined()
  })
})
