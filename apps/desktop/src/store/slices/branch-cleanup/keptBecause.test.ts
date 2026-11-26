import { describe, expect, it } from 'vitest';
import { keptBecauseFolder, keptBecauseOfError, keptBecauseOfMerge } from './keptBecause';

const BRANCH = 'nw/fix-settlement-replay';

describe('keptBecause', () => {
  it('calls only the base branch protected', () => {
    expect(keptBecauseOfMerge({ branch: 'main', state: { kind: 'protected' } })).toBe(
      'Kept main: it is a protected branch.',
    );
  });

  it('says a branch held by a worktree is in use, not protected', () => {
    const text = keptBecauseOfError({
      branch: BRANCH,
      error: { kind: 'held-by-worktree', path: '/worktrees/ledger-core' },
    });

    expect(text).toBe(
      `Kept ${BRANCH}: another worktree has it checked out. Remove that worktree first.`,
    );
    expect(text).not.toContain('protected');
  });

  it('says what to do when the worktree has uncommitted changes', () => {
    expect(keptBecauseFolder({ branch: BRANCH, reason: 'unstaged-changes' })).toBe(
      `Kept ${BRANCH}: its worktree has uncommitted changes. Remove the worktree first.`,
    );
  });

  it('passes any other reason through', () => {
    expect(
      keptBecauseFolder({ branch: BRANCH, reason: 'a terminal is open in the worktree' }),
    ).toBe(`Kept ${BRANCH}: a terminal is open in the worktree`);
    expect(keptBecauseFolder({ branch: BRANCH, reason: null })).toBe(
      `Kept ${BRANCH}: its folder couldn't be removed.`,
    );
  });
});
