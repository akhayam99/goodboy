import { describe, expect, it } from 'vitest'
import { assessTurnWeight } from './turn-weight'

describe('assessTurnWeight', () => {
  it('flags greetings as light', () => {
    expect(assessTurnWeight('hi')).toBe('light')
    expect(assessTurnWeight('hello')).toBe('light')
    expect(assessTurnWeight('thanks!')).toBe('light')
    expect(assessTurnWeight('ping')).toBe('light')
  })

  it('flags short single questions as light', () => {
    expect(assessTurnWeight('what does this function do?')).toBe('light')
    expect(assessTurnWeight('how do I rename this var?')).toBe('light')
  })

  it('flags trivial verbs as light', () => {
    expect(assessTurnWeight('rename foo to bar')).toBe('light')
    expect(assessTurnWeight('bump version to 2.0')).toBe('light')
    expect(assessTurnWeight('revert the last commit')).toBe('light')
  })

  it('flags long prompts as heavy', () => {
    expect(assessTurnWeight('x'.repeat(1600))).toBe('heavy')
  })

  it('flags code fences as heavy', () => {
    expect(assessTurnWeight('fix this:\n```ts\nconst x = 1;\n```')).toBe('heavy')
  })

  it('flags multi-step language as heavy', () => {
    expect(assessTurnWeight('first do X then do Y then do Z')).toBe('heavy')
    expect(assessTurnWeight('refactor auth across the whole codebase')).toBe('heavy')
  })

  it('flags architectural verbs as heavy', () => {
    expect(assessTurnWeight('design the new caching layer')).toBe('heavy')
    expect(assessTurnWeight('rewrite the parser')).toBe('heavy')
  })

  it('returns unknown for ambiguous prompts', () => {
    const ambiguous =
      'i was poking around the parser module yesterday afternoon and noticed some slightly odd behavior, not entirely sure where to start digging but i think it might be worth investigating the flow a bit further to understand what is going on, can you take a look at this when you have a moment'
    expect(assessTurnWeight(ambiguous)).toBe('unknown')
  })

  it('returns unknown for empty input', () => {
    expect(assessTurnWeight('')).toBe('unknown')
    expect(assessTurnWeight('   ')).toBe('unknown')
  })

  it('treats multi-line bullet lists as not light', () => {
    const bullets = '- foo\n- bar\n- baz'
    expect(assessTurnWeight(bullets)).not.toBe('light')
  })

  it('flags 3+ distinct file paths as heavy', () => {
    expect(
      assessTurnWeight(
        'update src/foo/bar.ts and packages/core/index.ts and apps/desktop/main.tsx',
      ),
    ).toBe('heavy')
  })

  it('does not flag 2 distinct paths in short text as heavy', () => {
    expect(assessTurnWeight('look at src/foo/bar.ts and packages/core/index.ts')).not.toBe('heavy')
  })

  it('does not flag the same path repeated 3 times as heavy', () => {
    expect(assessTurnWeight('src/foo/bar.ts src/foo/bar.ts src/foo/bar.ts')).not.toBe('heavy')
  })

  it('flags 3+ numbered list lines as heavy', () => {
    expect(assessTurnWeight('1. install deps\n2. run migrations\n3. start the server')).toBe(
      'heavy',
    )
  })

  it('flags attachmentCount >= 2 as heavy', () => {
    expect(assessTurnWeight('fix this', { attachmentCount: 2 })).toBe('heavy')
  })

  it('does not flag attachmentCount 1 with short text as heavy', () => {
    expect(assessTurnWeight('fix this', { attachmentCount: 1 })).not.toBe('heavy')
  })

  it('does not count e.g. or version numbers as file paths', () => {
    expect(assessTurnWeight('e.g. use version 4.5 and 2.0 here')).not.toBe('heavy')
  })
})
