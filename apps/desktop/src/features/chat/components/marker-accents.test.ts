import { describe, expect, it } from 'vitest'
import { MARKER_ACCENT, type MarkerType } from './marker-accents'

const ALL_TYPES: MarkerType[] = [
  'plan',
  'clusters',
  'handoff',
  'resolve',
  'wontfix',
  'error',
  'operations',
]

describe('MARKER_ACCENT', () => {
  it('has an entry for every MarkerType', () => {
    for (const type of ALL_TYPES) {
      expect(MARKER_ACCENT[type]).toBeDefined()
    }
  })

  it.each(ALL_TYPES)('%s has border, bg, text, and icon strings', (type) => {
    const accent = MARKER_ACCENT[type]
    expect(typeof accent.border).toBe('string')
    expect(typeof accent.bg).toBe('string')
    expect(typeof accent.text).toBe('string')
    expect(typeof accent.icon).toBe('string')
    expect(accent.border.length).toBeGreaterThan(0)
    expect(accent.bg.length).toBeGreaterThan(0)
    expect(accent.text.length).toBeGreaterThan(0)
    expect(accent.icon.length).toBeGreaterThan(0)
  })

  it('each type has a distinct color identity (no two types share all four fields)', () => {
    const serialize = (t: MarkerType) => {
      const a = MARKER_ACCENT[t]
      return `${a.border}|${a.bg}|${a.text}|${a.icon}`
    }
    const set = new Set(ALL_TYPES.map(serialize))
    expect(set.size).toBe(ALL_TYPES.length)
  })
})
