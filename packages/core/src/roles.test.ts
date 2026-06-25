import { describe, expect, it } from 'vitest'
import { ROLE_DEFAULTS, defaultsForRole, isAgentRole } from './roles'

describe('ROLE_DEFAULTS', () => {
  it('covers every defined AgentRole', () => {
    const expected = [
      'scout',
      'planner',
      'implementer',
      'reviewer',
      'investigator',
      'product',
      'architect',
      'tester',
      'explorer',
      'custom',
    ]
    for (const role of expected) {
      expect(ROLE_DEFAULTS[role as keyof typeof ROLE_DEFAULTS]).toBeDefined()
    }
    expect(Object.keys(ROLE_DEFAULTS).sort()).toEqual([...expected].sort())
  })

  it('routes read-heavy roles to the cheap model', () => {
    expect(ROLE_DEFAULTS.scout.model).toMatch(/haiku/)
    expect(ROLE_DEFAULTS.investigator.model).toMatch(/haiku/)
  })

  it('routes design-heavy roles to the strong model', () => {
    expect(ROLE_DEFAULTS.planner.model).toMatch(/opus/)
    expect(ROLE_DEFAULTS.architect.model).toMatch(/opus/)
  })

  it('routes balanced roles to sonnet', () => {
    expect(ROLE_DEFAULTS.implementer.model).toMatch(/sonnet/)
    expect(ROLE_DEFAULTS.reviewer.model).toMatch(/sonnet/)
  })

  it('every default uses anthropic provider for now', () => {
    for (const r of Object.values(ROLE_DEFAULTS)) {
      expect(r.provider).toBe('anthropic')
    }
  })
})

describe('isAgentRole', () => {
  it('returns true for known roles', () => {
    expect(isAgentRole('scout')).toBe(true)
    expect(isAgentRole('planner')).toBe(true)
    expect(isAgentRole('custom')).toBe(true)
  })

  it('returns false for unknown roles', () => {
    expect(isAgentRole('emperor')).toBe(false)
    expect(isAgentRole('')).toBe(false)
  })
})

describe('defaultsForRole', () => {
  it('returns the registered defaults for a known role', () => {
    expect(defaultsForRole('scout')).toBe(ROLE_DEFAULTS.scout)
    expect(defaultsForRole('reviewer')).toBe(ROLE_DEFAULTS.reviewer)
  })

  it('falls back to custom for an unknown role (no throw)', () => {
    expect(defaultsForRole('emperor')).toBe(ROLE_DEFAULTS.custom)
  })
})
