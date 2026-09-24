import { describe, expect, it } from 'vitest';
import { isJsonRecord, isStringArray, parseJsonColumn } from './parseJsonColumn';

describe('parseJsonColumn', () => {
  it('returns the parsed value when it passes the guard', () => {
    expect(parseJsonColumn({ value: '["a","b"]', isValid: isStringArray, fallback: [] })).toEqual([
      'a',
      'b',
    ]);
  });

  it('falls back on malformed json', () => {
    expect(parseJsonColumn({ value: '{"a":', isValid: isJsonRecord, fallback: {} })).toEqual({});
  });

  it('falls back when the shape does not match', () => {
    expect(parseJsonColumn({ value: '["a",1]', isValid: isStringArray, fallback: [] })).toEqual([]);
    expect(parseJsonColumn({ value: '[]', isValid: isJsonRecord, fallback: {} })).toEqual({});
  });

  it('falls back on a null column', () => {
    expect(parseJsonColumn({ value: null, isValid: isStringArray, fallback: [] })).toEqual([]);
  });
});
