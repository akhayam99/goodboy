// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ResolveStage } from '@goodboy/types';
import { projectReviewComment, reviewCommentStateOf } from './reviewCommentState';
import { rowFixOf } from './rowFix';
import { rowFixLineOf } from './rowFixCopy';
import { queueRowAt } from './testing/queueRow';

const SHA = '90b1d57f1c4e8a2b6d03f5a79c1e4b8d2a6f0c35';

type Params = {
  readonly stage: ResolveStage;
  readonly shas?: ReadonlyArray<string> | null;
};

const fixOf = ({ stage, shas = null }: Params) => {
  const base = queueRowAt({ stage, failedStep: stage === 'failed' ? 'run' : null });
  const row = { ...base, thread: { ...base.thread, commitShas: shas } };
  const state = reviewCommentStateOf({ row });
  return rowFixOf({ state, row, projection: projectReviewComment({ state, row }) });
};

describe('rowFixOf', () => {
  it('says fixing while the run works on the comment', () => {
    expect(fixOf({ stage: 'working' })).toEqual({ kind: 'fixing' });
  });

  it('says fixed with the short sha and the full one for the diff, and invites a review while it waits', () => {
    expect(fixOf({ stage: 'proposed', shas: [SHA] })).toEqual({
      kind: 'fixed',
      sha: '90b1d57',
      commit: SHA,
      isReview: true,
    });
  });

  it('stops inviting a review once the fix is accepted', () => {
    expect(fixOf({ stage: 'approved', shas: [SHA] })).toMatchObject({
      kind: 'fixed',
      isReview: false,
    });
  });

  it('says nothing for a reply with no commit, a new comment or a question', () => {
    expect(fixOf({ stage: 'proposed' })).toBeNull();
    expect(fixOf({ stage: 'new' })).toBeNull();
    expect(fixOf({ stage: 'asking' })).toBeNull();
  });

  it('says failed with the cause when the run did not finish', () => {
    expect(fixOf({ stage: 'failed' })).toEqual({ kind: 'failed', sentence: 'Cause not recorded' });
  });

  it('reads each state as one line', () => {
    expect(rowFixLineOf({ fix: { kind: 'fixing' } })).toBe('Fixing in the fix run');
    expect(
      rowFixLineOf({ fix: { kind: 'fixed', sha: '90b1d57', commit: SHA, isReview: true } }),
    ).toBe('Fixed in 90b1d57 · Review the fix');
    expect(
      rowFixLineOf({ fix: { kind: 'fixed', sha: '90b1d57', commit: SHA, isReview: false } }),
    ).toBe('Fixed in 90b1d57');
  });
});
