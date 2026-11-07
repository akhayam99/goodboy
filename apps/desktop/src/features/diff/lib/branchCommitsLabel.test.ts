import { describe, expect, it } from 'vitest';
import { branchCommitsLabel } from './branchCommitsLabel';

describe('branchCommitsLabel', () => {
  it('uses the authoritative total, even above the list cap', () => {
    expect(branchCommitsLabel({ listed: 100, total: 137 })).toBe('All 137 commits');
    expect(branchCommitsLabel({ listed: 1, total: 1 })).toBe('All 1 commit');
  });

  it('says the list is capped when no total is known', () => {
    expect(branchCommitsLabel({ listed: 100, total: null })).toBe('Latest 100 commits');
  });

  it('counts the listed commits below the cap when no total is known', () => {
    expect(branchCommitsLabel({ listed: 3, total: null })).toBe('All 3 commits');
    expect(branchCommitsLabel({ listed: 0, total: null })).toBeNull();
  });
});
