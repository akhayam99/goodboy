import { describe, expect, it } from 'vitest';
import { isBranchlessSession } from './isBranchlessSession';

describe('isBranchlessSession', () => {
  it('treats an explicitly empty session branch as branchless', () => {
    expect(isBranchlessSession({ branch: '' })).toBe(true);
  });

  it('treats a session with a branch as repo backed', () => {
    expect(isBranchlessSession({ branch: 'ak/feat-thing' })).toBe(false);
  });

  it('does not assume branchless while the branch is still unknown', () => {
    expect(isBranchlessSession({ branch: undefined })).toBe(false);
    expect(isBranchlessSession({ branch: null })).toBe(false);
  });
});
