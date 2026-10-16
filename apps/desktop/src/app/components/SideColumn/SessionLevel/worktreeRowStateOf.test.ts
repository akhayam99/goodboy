import { describe, expect, it } from 'vitest';
import { worktreeRowStateOf } from './worktreeRowStateOf';

const FINE: Parameters<typeof worktreeRowStateOf>[0] = {
  checks: 'success',
  behind: 0,
  conflicts: 0,
  isRebasing: false,
  isDecisionWaiting: false,
  commentsWaiting: 0,
  baseBranch: 'main',
};

describe('the worst state of a worktree row', () => {
  it('draws no dot on a fine worktree', () => {
    expect(worktreeRowStateOf(FINE)).toEqual({ tone: null, reason: null });
  });

  it('puts a failed check above every warning', () => {
    expect(
      worktreeRowStateOf({
        ...FINE,
        checks: 'failure',
        behind: 6,
        conflicts: 1,
        commentsWaiting: 3,
      }),
    ).toEqual({ tone: 'danger', reason: 'A check failed' });
  });

  it('names the warning that asks for a git act first, then the decision, then the comments', () => {
    expect(worktreeRowStateOf({ ...FINE, conflicts: 2, behind: 6 }).reason).toBe('2 conflicts');
    expect(worktreeRowStateOf({ ...FINE, isRebasing: true, behind: 6 }).reason).toBe(
      'Rebasing on main',
    );
    expect(worktreeRowStateOf({ ...FINE, behind: 6, isDecisionWaiting: true }).reason).toBe(
      '6 behind main',
    );
    expect(
      worktreeRowStateOf({ ...FINE, isDecisionWaiting: true, commentsWaiting: 2 }).reason,
    ).toBe('Needs a decision');
    expect(worktreeRowStateOf({ ...FINE, commentsWaiting: 1 })).toEqual({
      tone: 'warning',
      reason: '1 comment waits for you',
    });
  });

  it('reads an unknown distance as no warning', () => {
    expect(worktreeRowStateOf({ ...FINE, behind: null, conflicts: null, checks: null })).toEqual({
      tone: null,
      reason: null,
    });
  });
});
