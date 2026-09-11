import { describe, expect, it } from 'vitest';
import type { PullRequestState } from '@goodboy/types';
import { evaluatePrMergeReadiness } from './prMergeReadiness';

const pullRequest = (patch: Partial<PullRequestState> = {}): PullRequestState => ({
  number: 248,
  title: 'Retry failed requests',
  url: 'https://github.com/acme/web/pull/248',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'feature/retry',
  isDraft: false,
  reviewDecision: 'approved',
  body: '',
  updatedAt: '2026-01-01T00:00:00Z',
  ...patch,
});

describe('evaluatePrMergeReadiness', () => {
  it('clears a mergeable pull request with nothing outstanding', () => {
    const readiness = evaluatePrMergeReadiness({ pr: pullRequest() });

    expect(readiness.status).toBe('ready');
    expect(readiness.caveats).toEqual([]);
  });

  it('names the base branch when the head conflicts', () => {
    const readiness = evaluatePrMergeReadiness({ pr: pullRequest({ mergeable: false }) });

    expect(readiness.status).toBe('blocked');
    expect(readiness.reason).toBe('Resolve the conflicts with main first');
  });

  it('blocks a draft, a closed, a merged and a queued pull request', () => {
    expect(evaluatePrMergeReadiness({ pr: pullRequest({ isDraft: true }) }).reason).toBe(
      'Mark this pull request ready before merging',
    );
    expect(evaluatePrMergeReadiness({ pr: pullRequest({ state: 'closed' }) }).reason).toBe(
      'Reopen this pull request before merging',
    );
    expect(evaluatePrMergeReadiness({ pr: pullRequest({ state: 'merged' }) }).reason).toBe(
      'This pull request is already merged',
    );
    expect(evaluatePrMergeReadiness({ pr: pullRequest({ state: 'queued' }) }).reason).toBe(
      'GitHub is already set to merge this pull request',
    );
  });

  it('reads an uncomputed mergeable as unknown, never as ready and never as blocked', () => {
    const readiness = evaluatePrMergeReadiness({ pr: pullRequest({ mergeable: null }) });

    expect(readiness.status).toBe('unknown');
    expect(readiness.reason).toBe('GitHub has not finished checking whether this branch merges');
  });

  it('keeps the caveats of an unknown pull request', () => {
    const readiness = evaluatePrMergeReadiness({
      pr: pullRequest({ mergeable: null, checks: 'failure', reviewDecision: 'review_required' }),
    });

    expect(readiness.status).toBe('unknown');
    expect(readiness.caveats).toEqual(['A review is still requested', 'Checks are failing']);
  });

  it('lets a mergeable pull request through while naming what GitHub may refuse', () => {
    const readiness = evaluatePrMergeReadiness({
      pr: pullRequest({ checks: 'pending', reviewDecision: 'changes_requested' }),
    });

    expect(readiness.status).toBe('ready');
    expect(readiness.reason).toBe('GitHub can still refuse this merge');
    expect(readiness.caveats).toEqual(['A reviewer asked for changes', 'Checks are still running']);
  });

  it('says nothing about checks a repository does not run', () => {
    const readiness = evaluatePrMergeReadiness({ pr: pullRequest({ checks: null }) });

    expect(readiness.caveats).toEqual([]);
  });
});
