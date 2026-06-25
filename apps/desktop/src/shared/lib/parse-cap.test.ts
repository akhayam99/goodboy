import { describe, expect, it } from 'vitest'
import { parseCap } from './parse-cap'

describe('parseCap', () => {
  it('returns null for an empty string', () => {
    expect(parseCap('')).toBeNull()
  })

  it('returns null for whitespace-only input', () => {
    expect(parseCap('   ')).toBeNull()
  })

  it('returns null for zero', () => {
    expect(parseCap('0')).toBeNull()
  })

  it('returns null for negative values', () => {
    expect(parseCap('-1')).toBeNull()
  })

  it('returns null for non-numeric strings', () => {
    expect(parseCap('abc')).toBeNull()
  })

  it('returns null for Infinity', () => {
    expect(parseCap('Infinity')).toBeNull()
  })

  it('parses a plain integer', () => {
    expect(parseCap('5')).toBe(5)
  })

  it('parses a decimal value', () => {
    expect(parseCap('2.50')).toBe(2.5)
  })

  it('trims surrounding whitespace before parsing', () => {
    expect(parseCap('  3.00  ')).toBe(3)
  })

  it('parses very small positive values', () => {
    expect(parseCap('0.01')).toBe(0.01)
  })
})
