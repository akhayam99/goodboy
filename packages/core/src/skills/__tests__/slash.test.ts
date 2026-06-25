import { describe, it, expect } from 'vitest'
import { parseSlashCommand } from '../slash'

describe('parseSlashCommand', () => {
  it('returns null for empty input', () => {
    expect(parseSlashCommand('')).toBeNull()
  })

  it('returns null for whitespace-only input', () => {
    expect(parseSlashCommand('   \n  \n')).toBeNull()
  })

  it('returns null for bare slash', () => {
    expect(parseSlashCommand('/')).toBeNull()
  })

  it('returns null for input not starting with slash', () => {
    expect(parseSlashCommand('hello world')).toBeNull()
  })

  it('returns null for bad name starting with digit', () => {
    expect(parseSlashCommand('/123bad')).toBeNull()
  })

  it('returns null for bad name with uppercase', () => {
    expect(parseSlashCommand('/Foo')).toBeNull()
  })

  it('parses /foo with no args', () => {
    const result = parseSlashCommand('/foo')
    expect(result).toEqual({ name: 'foo', args: [], raw: '/foo' })
  })

  it('parses /foo with two positional args', () => {
    const result = parseSlashCommand('/foo arg1 arg2')
    expect(result).toEqual({ name: 'foo', args: ['arg1', 'arg2'], raw: '/foo arg1 arg2' })
  })

  it('parses /foo bar baz mixed', () => {
    const result = parseSlashCommand('/foo bar baz')
    expect(result).toEqual({ name: 'foo', args: ['bar', 'baz'], raw: '/foo bar baz' })
  })

  it('preserves double-quoted arg as single token', () => {
    const result = parseSlashCommand('/foo "with spaces"')
    expect(result).toEqual({ name: 'foo', args: ['with spaces'], raw: '/foo "with spaces"' })
  })

  it('preserves single-quoted arg as single token', () => {
    const result = parseSlashCommand("/foo 'single quotes'")
    expect(result).toEqual({ name: 'foo', args: ['single quotes'], raw: "/foo 'single quotes'" })
  })

  it('handles mixed quoted and unquoted args', () => {
    const result = parseSlashCommand('/foo bar "quoted value" baz')
    expect(result).toEqual({
      name: 'foo',
      args: ['bar', 'quoted value', 'baz'],
      raw: '/foo bar "quoted value" baz',
    })
  })

  it('trims leading whitespace before the slash', () => {
    const result = parseSlashCommand('   /foo bar')
    expect(result).toEqual({ name: 'foo', args: ['bar'], raw: '/foo bar' })
  })

  it('considers only first non-empty line for multi-line input', () => {
    const result = parseSlashCommand('/foo arg1\nignored line\n/bar ignored')
    expect(result).toEqual({ name: 'foo', args: ['arg1'], raw: '/foo arg1' })
  })

  it('skips leading blank lines to find first non-empty line', () => {
    const result = parseSlashCommand('\n\n/foo bar')
    expect(result).toEqual({ name: 'foo', args: ['bar'], raw: '/foo bar' })
  })

  it('returns null when first non-empty line is not a slash command', () => {
    const result = parseSlashCommand('not a command\n/foo bar')
    expect(result).toBeNull()
  })

  it('raw field matches original first non-empty line after trim', () => {
    const result = parseSlashCommand('  /my-cmd  x y  ')
    expect(result?.raw).toBe('/my-cmd  x y')
  })

  it('parses name with hyphens', () => {
    const result = parseSlashCommand('/my-command')
    expect(result).toEqual({ name: 'my-command', args: [], raw: '/my-command' })
  })

  it('parses name with digits after first char', () => {
    const result = parseSlashCommand('/foo2bar')
    expect(result).toEqual({ name: 'foo2bar', args: [], raw: '/foo2bar' })
  })
})
