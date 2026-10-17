// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PrCheckRun, PrDetail, PullRequestState } from '@goodboy/types';
import { checksCountsOf, checksGroupsOf, checksRunsOf, checksWordOf } from './checksRollup';

const run = (conclusion: PrCheckRun['conclusion'], name = 'check'): PrCheckRun => ({
  name,
  conclusion,
  detailsUrl: null,
  durationMs: null,
});

const pr = (patch: Partial<PullRequestState> = {}): PullRequestState => ({
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'open',
  mergeable: true,
  checks: null,
  baseBranch: 'main',
  headBranch: 'hl/fix-duplicate-credit',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-10-05T10:00:00Z',
  ...patch,
});

const detail = (patch: Partial<PrDetail> = {}): PrDetail => ({
  prNumber: 318,
  comments: [],
  reviews: [],
  reviewRequests: [],
  checks: [],
  ...patch,
});

describe('checksCountsOf', () => {
  it('counts failures, runs still going and passes, folding the conclusions with no name', () => {
    expect(
      checksCountsOf({
        checks: [
          run('success'),
          run('failure'),
          run('pending'),
          run('cancelled'),
          run('timed_out'),
          run('neutral'),
          run('unknown'),
        ],
      }),
    ).toEqual({ failing: 3, running: 2, passed: 2 });
  });
});

describe('checksGroupsOf', () => {
  it('lists Failing, Running, Passed and Skipped in that order and drops the empty ones', () => {
    const groups = checksGroupsOf({
      checks: [run('skipped', 'docs'), run('success', 'build'), run('failure', 'unit tests')],
    });

    expect(groups.map((entry) => [entry.label, entry.runs.map((check) => check.name)])).toEqual([
      ['Failing', ['unit tests']],
      ['Passed', ['build']],
      ['Skipped', ['docs']],
    ]);
  });

  it('keeps the order of the runs inside a group', () => {
    const groups = checksGroupsOf({
      checks: [run('success', 'lint'), run('success', 'build'), run('success', 'types')],
    });

    expect(groups[0]?.runs.map((check) => check.name)).toEqual(['lint', 'build', 'types']);
  });
});

describe('checksRunsOf', () => {
  it('reads nothing without a pull request or before its detail is loaded', () => {
    expect(checksRunsOf({ pr: null, detail: null })).toBeNull();
    expect(checksRunsOf({ pr: pr({ checks: 'failure' }), detail: null })).toBeNull();
    expect(checksRunsOf({ pr: pr(), detail: detail({ prNumber: 9 }) })).toBeNull();
  });

  it('reads nothing when the checks are unknown, denied or failed', () => {
    expect(checksRunsOf({ pr: pr({ checksUnknown: true }), detail: detail() })).toBeNull();
    expect(checksRunsOf({ pr: pr(), detail: detail({ checksRead: 'denied' }) })).toBeNull();
    expect(checksRunsOf({ pr: pr(), detail: detail({ checksRead: 'failed' }) })).toBeNull();
  });

  it('reads the runs of the matching detail', () => {
    const checks = [run('success')];
    expect(checksRunsOf({ pr: pr(), detail: detail({ checks }) })).toBe(checks);
  });
});

describe('checksWordOf', () => {
  it('says nothing when the runs are unread or none reported', () => {
    expect(checksWordOf({ runs: null })).toBeNull();
    expect(checksWordOf({ runs: [] })).toBeNull();
  });

  it('names the failures first, then what still runs, then what passed, never a zero', () => {
    expect(checksWordOf({ runs: [run('success'), run('failure'), run('failure')] })).toBe(
      '2 failing',
    );
    expect(checksWordOf({ runs: [run('success'), run('pending')] })).toBe('1 running');
    expect(checksWordOf({ runs: [run('success'), run('skipped')] })).toBe('2 passed');
  });
});
