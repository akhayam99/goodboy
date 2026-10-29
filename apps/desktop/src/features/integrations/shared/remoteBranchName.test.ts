import { describe, expect, it } from 'vitest';
import { remoteBranchName } from './remoteBranchName';

describe('remoteBranchName', () => {
  it('turns origin/main into main', () => {
    expect(remoteBranchName({ ref: 'origin/main', remotes: ['origin'] })).toBe('main');
  });

  it('turns upstream/develop into develop when upstream is a remote', () => {
    expect(remoteBranchName({ ref: 'upstream/develop', remotes: ['origin', 'upstream'] })).toBe(
      'develop',
    );
  });

  it('leaves a bare branch name alone', () => {
    expect(remoteBranchName({ ref: 'main', remotes: ['origin'] })).toBe('main');
  });

  it('leaves a branch whose first segment is not a remote alone', () => {
    expect(remoteBranchName({ ref: 'release/2026', remotes: ['origin'] })).toBe('release/2026');
    expect(remoteBranchName({ ref: 'upstream/develop', remotes: ['origin'] })).toBe(
      'upstream/develop',
    );
  });

  it('keeps the slashes that belong to the branch after the remote', () => {
    expect(remoteBranchName({ ref: 'origin/release/2026', remotes: ['origin'] })).toBe(
      'release/2026',
    );
  });

  it('prefers the longest remote name when two prefix the ref', () => {
    expect(remoteBranchName({ ref: 'team/fork/main', remotes: ['team', 'team/fork'] })).toBe(
      'main',
    );
  });

  it('reads fully qualified refs', () => {
    expect(remoteBranchName({ ref: 'refs/remotes/origin/main', remotes: ['origin'] })).toBe('main');
    expect(remoteBranchName({ ref: 'refs/heads/main', remotes: ['origin'] })).toBe('main');
  });

  it('trims the ref and keeps a ref that is only a remote', () => {
    expect(remoteBranchName({ ref: '  origin/main  ', remotes: ['origin'] })).toBe('main');
    expect(remoteBranchName({ ref: 'origin/', remotes: ['origin'] })).toBe('origin/');
  });
});
