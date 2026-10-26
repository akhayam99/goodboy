import { describe, expect, it } from 'vitest';
import { isJsonRecord, isStringArray, parseJsonColumn, parseJsonStrict } from './parseJsonColumn';

describe('parseJsonStrict', () => {
  it('returns the parsed value when it passes the guard', () => {
    expect(parseJsonStrict({ value: '["a"]', isValid: isStringArray, label: 'labels' })).toEqual([
      'a',
    ]);
  });

  it('throws on malformed json and on a wrong shape', () => {
    expect(() => parseJsonStrict({ value: '{"a":', isValid: isJsonRecord, label: 'meta' })).toThrow(
      'Invalid meta',
    );
    expect(() => parseJsonStrict({ value: '[]', isValid: isJsonRecord, label: 'meta' })).toThrow(
      'Invalid meta',
    );
  });
});

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
