// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import type { MergeFact } from './mergeFactsOf';
import { mergedSinceOf } from './mergedSinceOf';

const NOW = new Date(2026, 10, 27, 15, 0, 0).getTime();

type FactParams = {
  readonly key: string;
  readonly daysAgo: number;
  readonly hour: number;
};

const fact = ({ key, daysAgo, hour }: FactParams): MergeFact => ({
  key,
  sessionId: brandId<SessionId>({ value: `session-${key}` }),
  title: `Merged ${key}`,
  mergedAt: new Date(2026, 10, 27 - daysAgo, hour, 0, 0).toISOString(),
});

describe('mergedSinceOf', () => {
  it('lists the pull requests merged in the last seven days, newest first', () => {
    const week = mergedSinceOf({
      merges: [
        fact({ key: 'a', daysAgo: 3, hour: 9 }),
        fact({ key: 'b', daysAgo: 0, hour: 10 }),
        fact({ key: 'old', daysAgo: 8, hour: 9 }),
      ],
      nowMs: NOW,
    });

    expect(week.rows.map((row) => row.key)).toEqual(['b', 'a']);
  });

  it('counts each day, oldest first, today last', () => {
    const week = mergedSinceOf({
      merges: [
        fact({ key: 'a', daysAgo: 6, hour: 9 }),
        fact({ key: 'b', daysAgo: 0, hour: 10 }),
        fact({ key: 'c', daysAgo: 0, hour: 11 }),
      ],
      nowMs: NOW,
    });

    expect(week.byDay).toEqual([1, 0, 0, 0, 0, 0, 2]);
  });

  it('lists a branch once and drops a merge dated in the future', () => {
    const week = mergedSinceOf({
      merges: [
        fact({ key: 'a', daysAgo: 1, hour: 9 }),
        fact({ key: 'a', daysAgo: 1, hour: 9 }),
        fact({ key: 'later', daysAgo: -1, hour: 9 }),
      ],
      nowMs: NOW,
    });

    expect(week.rows.map((row) => row.key)).toEqual(['a']);
  });

  it('is empty with no merge', () => {
    expect(mergedSinceOf({ merges: [], nowMs: NOW })).toEqual({
      rows: [],
      byDay: [0, 0, 0, 0, 0, 0, 0],
    });
  });
});
