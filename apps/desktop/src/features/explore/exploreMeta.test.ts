import { describe, expect, it } from 'vitest';
import { exploreMetaOf } from './exploreMeta';

describe('exploreMetaOf', () => {
  it('counts the changed files and never the root', () => {
    expect(exploreMetaOf({ changeCount: 7 })).toBe('7 changed');
    expect(exploreMetaOf({ changeCount: 1 })).toBe('1 changed');
  });

  it('says nothing when nothing changed', () => {
    expect(exploreMetaOf({ changeCount: 0 })).toBeNull();
  });
});
