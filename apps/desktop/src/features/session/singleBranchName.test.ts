// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { singleBranchName } from './singleBranchName';

describe('singleBranchName', () => {
  it('names the branch of the one mount', () => {
    expect(
      singleBranchName({ mounts: [{ branch: 'ak/fix-ledger' }], sessionBranch: 'other' }),
    ).toBe('ak/fix-ledger');
  });

  it('falls back to the session branch without mounts', () => {
    expect(singleBranchName({ mounts: [], sessionBranch: 'ak/fix-ledger' })).toBe('ak/fix-ledger');
  });

  it('names nothing for several mounts, a blank or a missing branch', () => {
    expect(
      singleBranchName({ mounts: [{ branch: 'a' }, { branch: 'b' }], sessionBranch: 'a' }),
    ).toBeNull();
    expect(singleBranchName({ mounts: [], sessionBranch: '  ' })).toBeNull();
    expect(singleBranchName({ mounts: [], sessionBranch: null })).toBeNull();
  });
});
