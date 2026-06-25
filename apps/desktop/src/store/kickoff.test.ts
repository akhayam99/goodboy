import { describe, expect, it } from 'vitest'
import { buildGoalKickoffSection, composeKickoff } from './kickoff'

describe('buildGoalKickoffSection', () => {
  it('wraps a goal in a labelled section', () => {
    expect(buildGoalKickoffSection('Ship gitlab.')).toBe('Workflow goal:\n\nShip gitlab.')
  })

  it('returns an empty string for a missing or blank goal', () => {
    expect(buildGoalKickoffSection(undefined)).toBe('')
    expect(buildGoalKickoffSection('   ')).toBe('')
  })
})

describe('composeKickoff', () => {
  it('joins non-empty sections with a blank line', () => {
    expect(composeKickoff('goal', '', 'do it')).toBe('goal\n\ndo it')
  })

  it('returns an empty string when every section is empty', () => {
    expect(composeKickoff('', '')).toBe('')
  })
})
