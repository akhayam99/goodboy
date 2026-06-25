import { describe, expect, it } from 'vitest'
import { formatToolPattern, parseToolPattern } from './matcher'
import type { PermissionRulePattern } from '@goodboy/types'

describe('parseToolPattern', () => {
  it('bare tool name matches any args', () => {
    const m = parseToolPattern('Edit')
    expect(m.matches('Edit', { file_path: '/any/path' })).toBe(true)
    expect(m.matches('Edit', {})).toBe(true)
    expect(m.matches('Bash', {})).toBe(false)
  })

  it('wildcard * matches any tool and args', () => {
    const m = parseToolPattern('*')
    expect(m.matches('Edit', {})).toBe(true)
    expect(m.matches('Bash', { command: 'ls' })).toBe(true)
    expect(m.matches('AnythingElse', null)).toBe(true)
  })

  it('Bash(git:*) matches command with git: prefix (claude colon notation)', () => {
    const m = parseToolPattern('Bash(git:*)')
    expect(m.matches('Bash', { command: 'git:status' })).toBe(true)
    expect(m.matches('Bash', { command: 'git:commit' })).toBe(true)
    expect(m.matches('Bash', { command: 'ls -la' })).toBe(false)
    expect(m.matches('Edit', { command: 'git:status' })).toBe(false)
  })

  it('Bash(git *) matches space-separated git commands', () => {
    const m = parseToolPattern('Bash(git *)')
    expect(m.matches('Bash', { command: 'git status' })).toBe(true)
    expect(m.matches('Bash', { command: 'git commit' })).toBe(true)
    expect(m.matches('Bash', { command: 'ls -la' })).toBe(false)
  })

  it('Edit(/abs/**) matches file_path under /abs/', () => {
    const m = parseToolPattern('Edit(/abs/**)')
    expect(m.matches('Edit', { file_path: '/abs/foo/bar' })).toBe(true)
    expect(m.matches('Edit', { file_path: '/abs/' })).toBe(true)
    expect(m.matches('Edit', { file_path: '/other/foo' })).toBe(false)
  })

  it('single segment * does not cross : or /', () => {
    const m = parseToolPattern('Bash(git *)')
    expect(m.matches('Bash', { command: 'git status' })).toBe(true)
    const m2 = parseToolPattern('Bash(git:*)')
    expect(m2.matches('Bash', { command: 'git:foo:bar' })).toBe(false)
  })

  it('regex metachar escape: literal dot in path', () => {
    const m = parseToolPattern('Edit(/foo.bar/*)')
    expect(m.matches('Edit', { file_path: '/foo.bar/baz' })).toBe(true)
    expect(m.matches('Edit', { file_path: '/fooXbar/baz' })).toBe(false)
  })

  it('** glob matches across segments', () => {
    const m = parseToolPattern('Edit(/src/**)')
    expect(m.matches('Edit', { file_path: '/src/a/b/c/d.ts' })).toBe(true)
  })
})

describe('formatToolPattern round-trip', () => {
  it('bare tool', () => {
    const p: PermissionRulePattern = { tool: 'Edit' }
    expect(formatToolPattern(p)).toBe('Edit')
  })

  it('tool with argsMatcher', () => {
    const p: PermissionRulePattern = { tool: 'Bash', argsMatcher: 'git:*' }
    expect(formatToolPattern(p)).toBe('Bash(git:*)')
  })

  it('wildcard', () => {
    const p: PermissionRulePattern = { tool: '*' }
    expect(formatToolPattern(p)).toBe('*')
  })
})
