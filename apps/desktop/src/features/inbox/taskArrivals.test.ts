import { describe, expect, it } from 'vitest';
import { EMPTY_TASK_ARRIVALS, arrivedKeysOf, markSeenAt, noteFirstSeen } from './taskArrivals';

const DAY_MS = 86_400_000;

describe('noteFirstSeen', () => {
  it('stamps a key the first time and never moves the stamp afterwards', () => {
    const first = noteFirstSeen({ arrivals: EMPTY_TASK_ARRIVALS, keys: ['a', 'b'], now: 100 });

    const again = noteFirstSeen({ arrivals: first, keys: ['a', 'b', 'c'], now: 200 });

    expect(Object.fromEntries(again.firstSeen)).toEqual({ a: 100, b: 100, c: 200 });
  });

  it('returns the same ledger when nothing is new', () => {
    const first = noteFirstSeen({ arrivals: EMPTY_TASK_ARRIVALS, keys: ['a'], now: 100 });

    expect(noteFirstSeen({ arrivals: first, keys: ['a', 'a'], now: 200 })).toBe(first);
  });

  it('forgets a key that left the lists more than 45 days ago and keeps a recent one', () => {
    const old = noteFirstSeen({ arrivals: EMPTY_TASK_ARRIVALS, keys: ['gone', 'recent'], now: 0 });
    const later = noteFirstSeen({ arrivals: old, keys: ['x'], now: 44 * DAY_MS });
    const much = noteFirstSeen({ arrivals: later, keys: ['y'], now: 46 * DAY_MS });

    expect([...later.firstSeen.keys()].sort()).toEqual(['gone', 'recent', 'x']);
    expect([...much.firstSeen.keys()].sort()).toEqual(['x', 'y']);
  });

  it('keeps a listed key however old it is', () => {
    const old = noteFirstSeen({ arrivals: EMPTY_TASK_ARRIVALS, keys: ['open'], now: 0 });

    const later = noteFirstSeen({ arrivals: old, keys: ['open', 'fresh'], now: 90 * DAY_MS });

    expect([...later.firstSeen.keys()].sort()).toEqual(['fresh', 'open']);
  });

  it('treats a key named like an object member as a plain key', () => {
    const noted = noteFirstSeen({
      arrivals: EMPTY_TASK_ARRIVALS,
      keys: ['constructor', '__proto__'],
      now: 5,
    });

    expect([...noted.firstSeen.keys()].sort()).toEqual(['__proto__', 'constructor']);
  });

  it('caps the ledger at the newest 2000 keys', () => {
    const keys = Array.from({ length: 2_100 }, (_, index) => `k${index}`);

    const noted = noteFirstSeen({ arrivals: EMPTY_TASK_ARRIVALS, keys, now: 1 });

    expect(noted.firstSeen.size).toBe(2_000);
  });
});

describe('arrivedKeysOf', () => {
  const arrivals = markSeenAt({
    arrivals: noteFirstSeen({ arrivals: EMPTY_TASK_ARRIVALS, keys: ['old'], now: 100 }),
    now: 150,
  });
  const later = noteFirstSeen({ arrivals, keys: ['old', 'fresh'], now: 300 });

  it('lists the keys first seen after the stamp', () => {
    expect(arrivedKeysOf({ arrivals: later, keys: ['old', 'fresh'], since: 150 })).toEqual([
      'fresh',
    ]);
  });

  it('lists nothing before the first look, so the first load is not an arrival', () => {
    expect(arrivedKeysOf({ arrivals: later, keys: ['old', 'fresh'], since: null })).toEqual([]);
  });

  it('does not list a key stamped at the same instant as the look', () => {
    expect(arrivedKeysOf({ arrivals: later, keys: ['old'], since: 100 })).toEqual([]);
  });

  it('does not list a key it never saw', () => {
    expect(arrivedKeysOf({ arrivals: later, keys: ['unknown'], since: 0 })).toEqual([]);
  });
});
