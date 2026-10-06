// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WorktreeStatus } from '@goodboy/types';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { foreignCommitsBody, isForeignCommitCandidate, isWorktreeClean } from './foreignCommits';

const statusOf = (overrides: Partial<WorktreeStatus> = {}): WorktreeStatus => ({
  branch: 'grw-1348-cta',
  head: 'aaaaaaa1',
  headSubject: 'base',
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  mainDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: null,
  inProgress: null,
  ...overrides,
});

const rowOf = (overrides: Partial<MountRowView> = {}): MountRowView =>
  ({
    mountId: 'mount-1',
    projectId: 'project-1',
    projectName: 'ledger-core',
    projectKind: 'repo',
    mountName: 'ledger-core',
    branch: 'grw-1348-cta',
    baseBranch: 'main',
    worktreePath: '/worktrees/review',
    lastWorktreePath: '/worktrees/review',
    repoRoot: '/repo/ledger-core',
    isAttached: true,
    isMainCheckout: false,
    isOnDisk: true,
    revision: 0,
    parallelIndex: 0,
    request: null,
    series: null,
    observation: null,
    observedBranchHolder: null,
    isCompleted: false,
    ...overrides,
  }) as MountRowView;

const openRequest = {
  provider: 'github',
  identity: null,
  number: 9900,
  state: 'open',
  isDraft: false,
  checks: null,
  reviewDecision: null,
  url: '',
  title: 'Skip the slot step',
  label: 'PR #9900',
  headSha: 'bbbbbbb2',
} satisfies NonNullable<MountRowView['request']>;

describe('isForeignCommitCandidate', () => {
  it('flags a worktree on the base with an open pull request', () => {
    expect(
      isForeignCommitCandidate({ row: rowOf({ request: openRequest }), status: statusOf() }),
    ).toBe(true);
  });

  it('flags a worktree on the base whose own upstream has commits it lacks', () => {
    const status = statusOf({
      upstream: 'origin/grw-1348-cta',
      upstreamDistance: { kind: 'known', ahead: 0, behind: 2 },
    });

    expect(isForeignCommitCandidate({ row: rowOf(), status })).toBe(true);
  });

  it('ignores a fresh worktree with no pull request and no upstream', () => {
    expect(isForeignCommitCandidate({ row: rowOf(), status: statusOf() })).toBe(false);
  });

  it('ignores a worktree with commits of its own', () => {
    const status = statusOf({ mainDistance: { kind: 'known', ahead: 1, behind: 0 } });

    expect(isForeignCommitCandidate({ row: rowOf({ request: openRequest }), status })).toBe(false);
  });

  it('ignores a merged or closed request, a stopped rebase and an unread status', () => {
    const merged = { ...openRequest, state: 'merged' } satisfies MountRowView['request'];

    expect(isForeignCommitCandidate({ row: rowOf({ request: merged }), status: statusOf() })).toBe(
      false,
    );
    expect(
      isForeignCommitCandidate({
        row: rowOf({ request: openRequest }),
        status: statusOf({ inProgress: 'rebase' }),
      }),
    ).toBe(false);
    expect(isForeignCommitCandidate({ row: rowOf({ request: openRequest }), status: null })).toBe(
      false,
    );
  });

  it('ignores a worktree detached from its branch', () => {
    expect(
      isForeignCommitCandidate({
        row: rowOf({ request: openRequest }),
        status: statusOf({ branch: null }),
      }),
    ).toBe(false);
  });
});

describe('isWorktreeClean', () => {
  it('is clean only with a known empty working tree', () => {
    expect(isWorktreeClean({ status: statusOf() })).toBe(true);
    expect(
      isWorktreeClean({
        status: statusOf({
          workingTree: {
            kind: 'known',
            staged: 0,
            unstaged: 1,
            untracked: 0,
            unmerged: 0,
            changed: 1,
          },
        }),
      }),
    ).toBe(false);
    expect(
      isWorktreeClean({
        status: statusOf({ workingTree: { kind: 'unknown', reason: 'status-read-failed' } }),
      }),
    ).toBe(false);
  });
});

describe('foreignCommitsBody', () => {
  it('counts the commits and explains a dirty worktree', () => {
    expect(foreignCommitsBody({ branch: 'grw-1348-cta', remoteAhead: 1, isClean: true })).toBe(
      'origin/grw-1348-cta has 1 commit this worktree does not have.',
    );
    expect(foreignCommitsBody({ branch: 'grw-1348-cta', remoteAhead: 2, isClean: false })).toBe(
      'origin/grw-1348-cta has 2 commits this worktree does not have. Commit or discard the local changes first.',
    );
  });
});
