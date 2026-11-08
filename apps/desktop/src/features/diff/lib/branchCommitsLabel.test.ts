import { describe, expect, it } from 'vitest';
import { branchCommitsLabel, isCommitListCapped } from './branchCommitsLabel';

describe('branchCommitsLabel', () => {
  it('uses the authoritative total, even above the list cap', () => {
    expect(branchCommitsLabel({ listed: 100, total: 137 })).toBe('All 137 commits');
    expect(branchCommitsLabel({ listed: 1, total: 1 })).toBe('All 1 commit');
  });

  it('keeps the scope explicit when the capped list has no total', () => {
    expect(branchCommitsLabel({ listed: 100, total: null })).toBe('All commits');
  });

  it('flags a list at the cap or short of the total', () => {
    expect(isCommitListCapped({ listed: 100, total: 137 })).toBe(true);
    expect(isCommitListCapped({ listed: 100, total: null })).toBe(true);
    expect(isCommitListCapped({ listed: 3, total: 3 })).toBe(false);
  });

  it('counts the listed commits below the cap when no total is known', () => {
    expect(branchCommitsLabel({ listed: 3, total: null })).toBe('All 3 commits');
    expect(branchCommitsLabel({ listed: 0, total: null })).toBeNull();
  });
});
