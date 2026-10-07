import { describe, expect, it } from 'vitest';
import { isSameFacts } from './isSameFacts';

describe('isSameFacts', () => {
  it('treats facts with the same primitives and list items as the same', () => {
    expect(
      isSameFacts({
        previous: { title: 'Retry-safe', drafts: ['a', 'b'] },
        next: { title: 'Retry-safe', drafts: ['a', 'b'] },
      }),
    ).toBe(true);
  });

  it('treats a rebuilt plain object with the same entries as the same, so a revising plan does not loop', () => {
    expect(
      isSameFacts({
        previous: { revising: { kind: 'revising', nextRevision: 3 } },
        next: { revising: { kind: 'revising', nextRevision: 3 } },
      }),
    ).toBe(true);
  });

  it('sees a plain object whose entry changed', () => {
    expect(
      isSameFacts({
        previous: { revising: { kind: 'revising', nextRevision: 3 } },
        next: { revising: { kind: 'revising', nextRevision: 4 } },
      }),
    ).toBe(false);
  });

  it('sees a changed list item and a changed key count', () => {
    expect(isSameFacts({ previous: { drafts: ['a'] }, next: { drafts: ['b'] } })).toBe(false);
    expect(isSameFacts({ previous: { a: 1 }, next: { a: 1, b: 2 } })).toBe(false);
  });

  it('compares a missing side by identity', () => {
    expect(isSameFacts({ previous: null, next: null })).toBe(true);
    expect(isSameFacts({ previous: null, next: {} })).toBe(false);
  });
});
