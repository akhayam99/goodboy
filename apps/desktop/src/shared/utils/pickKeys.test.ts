// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pickKeys } from './pickKeys';

describe('pickKeys', () => {
  it('keeps only the asked keys that exist, by reference', () => {
    const shared = { n: 1 };
    const picked = pickKeys({ source: { a: shared, b: { n: 2 } }, keys: ['a', 'c'] });

    expect(Object.keys(picked)).toEqual(['a']);
    expect(picked['a']).toBe(shared);
  });

  it('returns an empty record when the source is not loaded', () => {
    expect(pickKeys({ source: undefined, keys: ['a'] })).toEqual({});
  });
});
