// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PrCheckRun, PrDetail, PullRequestState } from '@goodboy/types';
import { checksGroupsOf, checksRollup, checksWordOf } from './checksRollup';

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

describe('checksRollup', () => {
  it('says nothing when there is nothing to say', () => {
    expect(checksRollup({ checks: [] })).toBe('');
  });

  it('leads with the failures, then what is still running, then what passed', () => {
    expect(
      checksRollup({
        checks: [
          run('success'),
          run('failure'),
          run('pending'),
          run('failure'),
          ...Array.from({ length: 8 }, () => run('success')),
        ],
      }),
    ).toBe('2 failing · 1 running · 9 passed');
  });

  it('folds the conclusions with no plain-language name of their own', () => {
    expect(
      checksRollup({
        checks: [run('timed_out'), run('neutral'), run('stale'), run('action_required')],
      }),
    ).toBe('2 failing · 2 skipped');
  });

  it('counts a cancelled run as failing, the way the pull request rollup does', () => {
    expect(checksRollup({ checks: [run('cancelled'), run('success')] })).toBe(
      '1 failing · 1 passed',
    );
  });

  it('counts a run with no verdict as still running', () => {
    expect(checksRollup({ checks: [run('unknown')] })).toBe('1 running');
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

describe('checksWordOf', () => {
  it('is none without a pull request', () => {
    expect(checksWordOf({ pr: null, detail: null })).toBe('none');
  });

  it('is unknown when the list read could not see the checks', () => {
    expect(checksWordOf({ pr: pr({ checksUnknown: true }), detail: null })).toBe('unknown');
  });

  it.each(['denied', 'failed'] as const)(
    'is unknown when the detail read of the checks is %s',
    (checksRead) => {
      expect(checksWordOf({ pr: pr({ checks: 'success' }), detail: detail({ checksRead }) })).toBe(
        'unknown',
      );
    },
  );

  it('is none, never unknown, when the read worked and nothing has reported', () => {
    expect(
      checksWordOf({ pr: pr(), detail: detail({ checksRead: 'ok', checksError: null }) }),
    ).toBe('none');
  });

  it('reads the runs of the detail when it has them', () => {
    expect(
      checksWordOf({ pr: pr(), detail: detail({ checks: [run('success'), run('failure')] }) }),
    ).toBe('failing');
    expect(
      checksWordOf({ pr: pr(), detail: detail({ checks: [run('success'), run('pending')] }) }),
    ).toBe('pending');
    expect(checksWordOf({ pr: pr(), detail: detail({ checks: [run('success')] }) })).toBe(
      'passing',
    );
  });

  it('falls back to the rollup of the list while no detail is loaded', () => {
    expect(checksWordOf({ pr: pr({ checks: 'failure' }), detail: null })).toBe('failing');
    expect(checksWordOf({ pr: pr({ checks: 'pending' }), detail: null })).toBe('pending');
    expect(checksWordOf({ pr: pr({ checks: 'success' }), detail: null })).toBe('passing');
    expect(checksWordOf({ pr: pr({ checks: null }), detail: null })).toBe('none');
  });

  it('ignores the detail of another pull request', () => {
    expect(
      checksWordOf({
        pr: pr({ checks: 'success' }),
        detail: detail({ prNumber: 12, checksRead: 'denied' }),
      }),
    ).toBe('passing');
  });
});
