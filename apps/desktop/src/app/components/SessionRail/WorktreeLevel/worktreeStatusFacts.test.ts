import { describe, expect, it } from 'vitest';
import { worktreeStatusFactsOf } from './worktreeStatusFacts';

const BASE: Parameters<typeof worktreeStatusFactsOf>[0] = {
  behind: null,
  conflicts: null,
  isRebasing: false,
  progress: null,
  baseBranch: 'main',
};

describe('the worktree status line', () => {
  it('says nothing when the worktree is level with its base', () => {
    expect(worktreeStatusFactsOf(BASE)).toBeNull();
    expect(worktreeStatusFactsOf({ ...BASE, behind: 0, conflicts: 0 })).toBeNull();
  });

  it('says how far behind the base the branch is', () => {
    expect(worktreeStatusFactsOf({ ...BASE, behind: 6 })).toBe('6 behind main');
  });

  it('reads the rebase job, its progress and the conflicts, never the base again', () => {
    expect(
      worktreeStatusFactsOf({ ...BASE, isRebasing: true, progress: '3 of 7', conflicts: 1 }),
    ).toBe('Rebasing · 3 of 7 · 1 conflict');
    expect(worktreeStatusFactsOf({ ...BASE, isRebasing: true, behind: 6 })).toBe('Rebasing');
  });
});
