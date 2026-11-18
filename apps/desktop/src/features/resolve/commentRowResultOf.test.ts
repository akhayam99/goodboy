// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { commentRowResultOf } from './commentRowResultOf';
import type { RowFix } from './rowFix';

const FIXED: RowFix = { kind: 'fixed', sha: '90b1d57', commit: '90b1d57f1c4e', isReview: true };
const FAILED: RowFix = { kind: 'failed', sentence: 'The agent ended without a result' };

describe('commentRowResultOf', () => {
  it('offers Review and Apply on a fix that waits for you', () => {
    expect(
      commentRowResultOf({
        state: 'ready',
        resolveWord: 'to_review',
        fix: FIXED,
        isStopped: false,
        isPushing: false,
      }),
    ).toEqual({ state: 'fixReady', detail: 'Fixed in 90b1d57', action: 'reviewApply' });
  });

  it('says Applied, not pushed with Open changes once you applied it', () => {
    expect(
      commentRowResultOf({
        state: 'accepted',
        resolveWord: 'ready',
        fix: { ...FIXED, isReview: false },
        isStopped: false,
        isPushing: false,
      }),
    ).toEqual({
      state: 'appliedNotPushed',
      detail: 'Fixed in 90b1d57, the next push sends it',
      action: 'openChanges',
    });
  });

  it('leaves a fix that is being pushed to its Pushing word', () => {
    expect(
      commentRowResultOf({
        state: 'accepted',
        resolveWord: 'ready',
        fix: FIXED,
        isStopped: false,
        isPushing: true,
      }),
    ).toBeNull();
  });

  it('says Failed or Stopped with the reason and Retry', () => {
    expect(
      commentRowResultOf({
        state: 'failed',
        resolveWord: 'couldnt_fix',
        fix: FAILED,
        isStopped: false,
        isPushing: false,
      }),
    ).toEqual({ state: 'failed', detail: FAILED.sentence, action: 'retry' });
    expect(
      commentRowResultOf({
        state: 'failed',
        resolveWord: 'couldnt_fix',
        fix: { kind: 'failed', sentence: 'You stopped it' },
        isStopped: true,
        isPushing: false,
      }),
    ).toEqual({ state: 'stopped', detail: 'You stopped it', action: 'retry' });
  });

  it('says nothing for a reply with no commit, a changed comment or a pushed fix', () => {
    expect(
      commentRowResultOf({
        state: 'ready',
        resolveWord: 'to_review',
        fix: null,
        isStopped: false,
        isPushing: false,
      }),
    ).toBeNull();
    expect(
      commentRowResultOf({
        state: 'outdated',
        resolveWord: 'to_review',
        fix: FIXED,
        isStopped: false,
        isPushing: false,
      }),
    ).toBeNull();
    expect(
      commentRowResultOf({
        state: 'pushed',
        resolveWord: 'replied',
        fix: FIXED,
        isStopped: false,
        isPushing: false,
      }),
    ).toBeNull();
  });
});
