import { describe, expect, it } from 'vitest';
import { resolveStringArray } from './resolve-json';

describe('resolveStringArray', () => {
  it('reads a stored string array', () => {
    expect(resolveStringArray({ json: '["abc1234","def5678"]' })).toEqual(['abc1234', 'def5678']);
  });

  it('reads malformed or mistyped json as an empty list', () => {
    expect(resolveStringArray({ json: '["abc1234"' })).toEqual([]);
    expect(resolveStringArray({ json: '["abc1234",7]' })).toEqual([]);
  });
});
