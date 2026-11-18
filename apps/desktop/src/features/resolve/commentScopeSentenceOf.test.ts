import { describe, expect, it } from 'vitest';
import { commentScopeSentenceOf } from './commentScopeSentenceOf';

describe('commentScopeSentenceOf says why a comment suggests a run', () => {
  it('names the signs and the places, in reading order', () => {
    expect(
      commentScopeSentenceOf({
        scope: {
          isBroad: true,
          signs: ['rethink', 'places'],
          places: ['the payouts route', 'AppLayout', 'LedgerHeader'],
        },
      }),
    ).toBe('It asks for a rework and names the payouts route, AppLayout and LedgerHeader.');
  });

  it('counts the places once there are more than three', () => {
    expect(
      commentScopeSentenceOf({
        scope: {
          isBroad: true,
          signs: ['rethink', 'places', 'long'],
          places: ['a.ts', 'b.ts', 'c.ts', 'd.ts'],
        },
      }),
    ).toBe('It asks for a rework, names 4 other places and is long.');
  });

  it('says nothing when no sign made the comment broad', () => {
    expect(commentScopeSentenceOf({ scope: { isBroad: false, signs: [], places: [] } })).toBe('');
  });
});
