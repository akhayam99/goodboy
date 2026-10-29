import { describe, expect, it } from 'vitest';
import type { BranchCommit } from '@goodboy/types';
import { historyDaysOf } from './historyDaysOf';

type Params = {
  readonly sha: string;
  readonly date: Date;
};

const commit = ({ sha, date }: Params): BranchCommit => ({
  sha,
  shortSha: sha,
  subject: 'Acme credit',
  author: 'Harborline',
  timestamp: date.getTime() / 1000,
  pushed: true,
  parentSha: null,
});

const NOW = new Date(2026, 9, 29, 12).getTime();

describe('historyDaysOf', () => {
  it('returns no header for an empty history', () => {
    expect(historyDaysOf({ commits: [], nowMs: NOW })).toEqual([]);
  });

  it('groups adjacent commits by their local calendar day', () => {
    const commits = [
      commit({ sha: 'a', date: new Date(2026, 9, 29, 10) }),
      commit({ sha: 'b', date: new Date(2026, 9, 29, 0) }),
      commit({ sha: 'c', date: new Date(2026, 9, 28, 23, 59) }),
      commit({ sha: 'd', date: new Date(2026, 9, 26, 15) }),
    ];
    const days = historyDaysOf({ commits, nowMs: NOW });
    expect(days.map((day) => day.label)).toEqual([
      'Today',
      'Yesterday',
      new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short' }).format(
        new Date(2026, 9, 26, 15),
      ),
    ]);
    expect(days.map((day) => day.commits.map((entry) => entry.sha))).toEqual([
      ['a', 'b'],
      ['c'],
      ['d'],
    ]);
  });

  it('preserves a reordered history even when a day occurs twice', () => {
    const commits = [
      commit({ sha: 'a', date: new Date(2026, 9, 29, 10) }),
      commit({ sha: 'b', date: new Date(2026, 9, 28, 10) }),
      commit({ sha: 'c', date: new Date(2026, 9, 29, 9) }),
    ];
    expect(historyDaysOf({ commits, nowMs: NOW }).map((day) => day.commits)).toEqual(
      commits.map((entry) => [entry]),
    );
  });

  it('handles yesterday across a year boundary and labels older years', () => {
    const previousYear = new Date(2024, 11, 31, 10);
    const days = historyDaysOf({
      commits: [
        commit({ sha: 'a', date: new Date(2026, 0, 1, 0) }),
        commit({ sha: 'b', date: new Date(2025, 11, 31, 23) }),
        commit({ sha: 'c', date: previousYear }),
      ],
      nowMs: new Date(2026, 0, 1, 12).getTime(),
    });
    expect(days.map((day) => day.label)).toEqual([
      'Today',
      'Yesterday',
      new Intl.DateTimeFormat('en', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(previousYear),
    ]);
  });

  it('uses calendar days when the clock changes for daylight saving', () => {
    const days = historyDaysOf({
      commits: [commit({ sha: 'a', date: new Date(2026, 9, 25, 0, 30) })],
      nowMs: new Date(2026, 9, 26, 0, 15).getTime(),
    });
    expect(days[0]?.label).toBe('Yesterday');
  });
});
