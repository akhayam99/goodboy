import { describe, expect, it } from 'vitest';
import { isBranchlessSession } from './isBranchlessSession';

describe('isBranchlessSession', () => {
  it('treats every session of a simple workspace as branchless', () => {
    expect(isBranchlessSession({ workspaceKind: 'simple', branch: undefined })).toBe(true);
    expect(isBranchlessSession({ workspaceKind: 'simple', branch: '' })).toBe(true);
  });

  it('keeps a plain session directory branchless after the workspace becomes a repo', () => {
    expect(isBranchlessSession({ workspaceKind: 'repo', branch: '' })).toBe(true);
  });

  it('treats a session with a branch as repo backed', () => {
    expect(isBranchlessSession({ workspaceKind: 'repo', branch: 'ak/feat-thing' })).toBe(false);
    expect(isBranchlessSession({ workspaceKind: 'composite', branch: 'ak/feat-thing' })).toBe(
      false,
    );
  });

  it('does not assume branchless while the branch is still unknown', () => {
    expect(isBranchlessSession({ workspaceKind: 'repo', branch: undefined })).toBe(false);
    expect(isBranchlessSession({ workspaceKind: 'repo', branch: null })).toBe(false);
  });
});
