// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fileLinkRelPath } from './fileLinkRelPath';

const ROOT = '/work/ledger-core';

describe('fileLinkRelPath', () => {
  it('resolves a relative path from the folder the output came from', () => {
    expect(
      fileLinkRelPath({ root: ROOT, baseDir: `${ROOT}/packages/api`, path: 'src/pay.ts' }),
    ).toBe('packages/api/src/pay.ts');
  });

  it('resolves ./ and ../ inside the worktree', () => {
    expect(fileLinkRelPath({ root: ROOT, baseDir: `${ROOT}/a/b`, path: '../c/./d.ts' })).toBe(
      'a/c/d.ts',
    );
  });

  it('accepts an absolute path under the worktree', () => {
    expect(fileLinkRelPath({ root: ROOT, baseDir: ROOT, path: `${ROOT}/src/x.ts` })).toBe(
      'src/x.ts',
    );
  });

  it('refuses a path that climbs out of the worktree', () => {
    expect(fileLinkRelPath({ root: ROOT, baseDir: ROOT, path: '../notify-relay/x.ts' })).toBeNull();
    expect(
      fileLinkRelPath({ root: ROOT, baseDir: ROOT, path: '../../../../etc/hosts' }),
    ).toBeNull();
  });

  it('refuses an absolute path outside the worktree or in a sibling with the same prefix', () => {
    expect(fileLinkRelPath({ root: ROOT, baseDir: ROOT, path: '/etc/passwd' })).toBeNull();
    expect(
      fileLinkRelPath({ root: ROOT, baseDir: ROOT, path: '/work/ledger-core-old/x.ts' }),
    ).toBeNull();
  });

  it('refuses the worktree folder itself', () => {
    expect(fileLinkRelPath({ root: ROOT, baseDir: ROOT, path: ROOT })).toBeNull();
  });
});
