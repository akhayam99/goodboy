// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { StagePullRequest } from './attentionFactsOf';
import { deferredReasonsOf } from './deferredReasonsOf';

const PR: StagePullRequest = {
  number: 318,
  state: 'open',
  isDraft: false,
  checks: 'failure',
  reviewDecision: null,
};

const dismissed = (...fingerprints: ReadonlyArray<string>): ReadonlySet<string> =>
  new Set(fingerprints);

describe('deferredReasonsOf', () => {
  it('defers failing checks once Fix failing checks was put away for this pull request', () => {
    expect([
      ...deferredReasonsOf({ dismissed: dismissed('fix-checks:mount-1:318'), pr: PR }),
    ]).toEqual(['ci-failed']);
  });

  it('defers the approval once Merge was put away for this pull request', () => {
    expect([
      ...deferredReasonsOf({ dismissed: dismissed('merge-pr:mount-1:318'), pr: PR }),
    ]).toEqual(['pr-approved']);
  });

  it('returns when the situation changes: another pull request, or a new stage of the fix', () => {
    expect(deferredReasonsOf({ dismissed: dismissed('fix-checks:mount-1:317'), pr: PR }).size).toBe(
      0,
    );
    expect(
      deferredReasonsOf({
        dismissed: dismissed('fix-checks:mount-1:318:fixed-pushed:failed'),
        pr: PR,
      }).size,
    ).toBe(0);
  });

  it('never defers on a suggestion that has nothing to do with the pull request', () => {
    expect(
      deferredReasonsOf({
        dismissed: dismissed('answer-questions:session-1:318', 'open-pr:mount-1:318'),
        pr: PR,
      }).size,
    ).toBe(0);
  });

  it('defers nothing without dismissals or without a pull request', () => {
    expect(deferredReasonsOf({ dismissed: undefined, pr: PR }).size).toBe(0);
    expect(deferredReasonsOf({ dismissed: dismissed(), pr: PR }).size).toBe(0);
    expect(
      deferredReasonsOf({ dismissed: dismissed('fix-checks:mount-1:318'), pr: null }).size,
    ).toBe(0);
  });

  it('hands back one empty set, so a shallow compare holds', () => {
    expect(deferredReasonsOf({ dismissed: undefined, pr: PR })).toBe(
      deferredReasonsOf({ dismissed: dismissed(), pr: null }),
    );
  });
});
