// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { MountId, ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';

const { gitCommonDirectory, worktreeGitDirectory } = vi.hoisted(() => ({
  gitCommonDirectory: vi.fn(
    async (_args: { readonly repoPath: string }): Promise<string | null> => null,
  ),
  worktreeGitDirectory: vi.fn(
    async (_args: { readonly worktreePath: string }): Promise<string | null> => null,
  ),
}));

vi.mock('../../../features/worktree/worktree', () => ({
  gitCommonDirectory,
  worktreeGitDirectory,
}));

import {
  buildTurnWritableRoots,
  repoRootsForTurn,
  resolveWorktreeGitDirs,
  worktreePathsForTurn,
} from './turnWritableRoots';

const mount = (overrides: Partial<SessionProjectMount> = {}): SessionProjectMount => ({
  mountId: 'mount-api' as MountId,
  sessionId: 'session-roots' as SessionId,
  projectId: 'project-api' as ProjectId,
  mountName: 'api',
  worktreePath: '/repo/api/.goodboy/worktrees/first',
  lastWorktreePath: null,
  repoRoot: '/repo/api',
  branch: 'goodboy/first',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
  ...overrides,
});

const first = mount();
const second = mount({
  mountName: 'api 2',
  worktreePath: '/repo/api/.goodboy/worktrees/second',
  branch: 'goodboy/second',
});

describe('buildTurnWritableRoots', () => {
  it('adds the sibling worktree and the git directory but never their parent', () => {
    const roots = buildTurnWritableRoots({
      mounts: [first, second],
      workingDir: first.worktreePath,
      gitDirs: new Map([['/repo/api', '/repo/api/.git']]),
      worktreeGitDirs: new Map(),
    });

    expect(roots).toEqual(['/repo/api/.goodboy/worktrees/second', '/repo/api/.git']);
    expect(roots).not.toContain('/repo/api');
    expect(roots).not.toContain('/repo/api/.goodboy/worktrees');
  });

  it('takes the git directory git reports instead of assuming a .git folder', () => {
    const roots = buildTurnWritableRoots({
      mounts: [first],
      workingDir: first.worktreePath,
      gitDirs: new Map([['/repo/api', '/elsewhere/api.git']]),
      worktreeGitDirs: new Map(),
    });

    expect(roots).toEqual(['/elsewhere/api.git']);
  });

  it('falls back to the conventional git directory when git answered nothing', () => {
    const roots = buildTurnWritableRoots({
      mounts: [first],
      workingDir: '/somewhere/else',
      gitDirs: new Map(),
      worktreeGitDirs: new Map(),
    });

    expect(roots).toEqual(['/repo/api/.goodboy/worktrees/first', '/repo/api/.git']);
  });

  it('excludes a detached mount and a branchless folder mount', () => {
    const roots = buildTurnWritableRoots({
      mounts: [
        mount({ worktreePath: '/repo/api/.goodboy/worktrees/gone', isAttached: false }),
        mount({
          projectId: 'project-notes' as ProjectId,
          repoRoot: '/repo/notes',
          worktreePath: '/repo/notes/sessions/goal',
          branch: '',
        }),
      ],
      workingDir: '/repo/api/.goodboy/worktrees/first',
      gitDirs: new Map(),
      worktreeGitDirs: new Map(),
    });

    expect(roots).toEqual([]);
  });
});

describe('buildTurnWritableRoots in a linked worktree', () => {
  const firstOwn = '/repo/api/.git/worktrees/first';
  const secondOwn = '/repo/api/.git/worktrees/second';

  it('adds the per-worktree git directory next to the common one', () => {
    const roots = buildTurnWritableRoots({
      mounts: [first],
      workingDir: first.worktreePath,
      gitDirs: new Map([['/repo/api', '/repo/api/.git']]),
      worktreeGitDirs: new Map([[first.worktreePath, firstOwn]]),
    });

    expect(roots).toEqual(['/repo/api/.git', firstOwn]);
  });

  it('adds the git directory of every sibling worktree it can write', () => {
    const roots = buildTurnWritableRoots({
      mounts: [first, second],
      workingDir: first.worktreePath,
      gitDirs: new Map([['/repo/api', '/repo/api/.git']]),
      worktreeGitDirs: new Map([
        [first.worktreePath, firstOwn],
        [second.worktreePath, secondOwn],
      ]),
    });

    expect(roots).toEqual([second.worktreePath, '/repo/api/.git', firstOwn, secondOwn]);
  });

  it('names a shared git directory once when the worktree is the main checkout', () => {
    const roots = buildTurnWritableRoots({
      mounts: [first],
      workingDir: first.worktreePath,
      gitDirs: new Map([['/repo/api', '/repo/api/.git']]),
      worktreeGitDirs: new Map([[first.worktreePath, '/repo/api/.git']]),
    });

    expect(roots).toEqual(['/repo/api/.git']);
  });

  it('skips the per-worktree directory git did not report', () => {
    const roots = buildTurnWritableRoots({
      mounts: [first],
      workingDir: first.worktreePath,
      gitDirs: new Map([['/repo/api', '/repo/api/.git']]),
      worktreeGitDirs: new Map(),
    });

    expect(roots).toEqual(['/repo/api/.git']);
  });
});

describe('worktreePathsForTurn', () => {
  it('names each writable worktree once and skips detached mounts', () => {
    const paths = worktreePathsForTurn({
      mounts: [
        first,
        second,
        mount({ worktreePath: '/repo/api/.goodboy/worktrees/gone', isAttached: false }),
      ],
    });

    expect(paths).toEqual([first.worktreePath, second.worktreePath]);
  });
});

describe('resolveWorktreeGitDirs', () => {
  it('asks git for each worktree and drops the ones it cannot answer', async () => {
    worktreeGitDirectory.mockImplementation(async ({ worktreePath }) => {
      if (worktreePath === 'api-gone') {
        return null;
      }
      if (worktreePath === 'api-broken') {
        throw new Error('not a git repository');
      }
      return `${worktreePath}.git`;
    });

    const resolved = await resolveWorktreeGitDirs({
      worktreePaths: ['api-first', 'api-gone', 'api-broken'],
    });

    expect(Array.from(resolved)).toEqual([['api-first', 'api-first.git']]);
  });
});

describe('repoRootsForTurn', () => {
  it('names each repository once and skips the mounts that cannot be written', () => {
    const roots = repoRootsForTurn({
      mounts: [first, second, mount({ repoRoot: '/repo/web', branch: '' })],
    });

    expect(roots).toEqual(['/repo/api']);
  });
});
