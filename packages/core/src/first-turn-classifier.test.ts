import { describe, expect, it } from 'vitest'
import { classifyFirstTurn, type AgentKindLabel } from './first-turn-classifier'

describe('classifyFirstTurn', () => {
  it.each<[string, AgentKindLabel]>([
    ['pianifica la migrazione', 'planner'],
    ['plan the new feature flow', 'planner'],
    ['design the API surface', 'planner'],
  ])('planner: %s', (text, expected) => {
    expect(classifyFirstTurn(text)).toBe(expected)
  })

  it.each<[string, AgentKindLabel]>([
    ['scout the providers package', 'scout'],
    ['find where user auth is defined', 'scout'],
    ['explore the codebase', 'scout'],
    ['grep for AGENT_KIND_PALETTE', 'scout'],
  ])('scout: %s', (text, expected) => {
    expect(classifyFirstTurn(text)).toBe(expected)
  })

  it.each<[string, AgentKindLabel]>([
    ['implement the chip auto-label', 'implementer'],
    ['build a settings dialog', 'implementer'],
    ['refactor the reducer', 'implementer'],
  ])('implementer: %s', (text, expected) => {
    expect(classifyFirstTurn(text)).toBe(expected)
  })

  it.each<[string, AgentKindLabel]>([
    ['debug the crash on startup', 'debugger'],
    ['why is the chip blank', 'debugger'],
    ['the app is broken on macOS', 'debugger'],
    ['repro the failure', 'debugger'],
  ])('debugger: %s', (text, expected) => {
    expect(classifyFirstTurn(text)).toBe(expected)
  })

  it.each<[string, AgentKindLabel]>([
    ['write a test for the parser', 'tester'],
    ['test coverage for budget alerts', 'tester'],
  ])('tester: %s', (text, expected) => {
    expect(classifyFirstTurn(text)).toBe(expected)
  })

  it.each<[string, AgentKindLabel]>([
    ['update docs for the provider adapter', 'docs'],
    ['update the readme', 'docs'],
  ])('docs: %s', (text, expected) => {
    expect(classifyFirstTurn(text)).toBe(expected)
  })

  it.each<[string, AgentKindLabel]>([
    ['review the diff', 'reviewer'],
    ['audit the permission engine', 'reviewer'],
  ])('reviewer: %s', (text, expected) => {
    expect(classifyFirstTurn(text)).toBe(expected)
  })

  it('returns generic on empty input', () => {
    expect(classifyFirstTurn('')).toBe('generic')
    expect(classifyFirstTurn('   \n')).toBe('generic')
  })

  it('returns generic when no category matches', () => {
    expect(classifyFirstTurn('hello')).toBe('generic')
    expect(classifyFirstTurn('thanks!')).toBe('generic')
    expect(classifyFirstTurn('continue')).toBe('generic')
  })

  it('first-match-wins across categories (planner > scout > implementer > debugger > tester > docs > reviewer)', () => {
    expect(classifyFirstTurn('plan and implement the migration')).toBe('planner')
    expect(classifyFirstTurn('find and refactor the store')).toBe('scout')
    expect(classifyFirstTurn('implement and test the parser')).toBe('implementer')
    expect(classifyFirstTurn('debug and test the failure')).toBe('debugger')
    expect(classifyFirstTurn('write a test and update docs')).toBe('tester')
    expect(classifyFirstTurn('update docs and review them')).toBe('docs')
  })

  it('is case-insensitive', () => {
    expect(classifyFirstTurn('FIND the bug')).toBe('scout')
    expect(classifyFirstTurn('Review THIS')).toBe('reviewer')
  })

  it('does not match substrings inside words', () => {
    expect(classifyFirstTurn('preplanned')).toBe('generic')
    expect(classifyFirstTurn('refundable')).toBe('generic')
    expect(classifyFirstTurn('attesting')).toBe('generic')
  })
})
