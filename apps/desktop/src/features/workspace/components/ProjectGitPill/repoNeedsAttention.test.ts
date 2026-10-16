// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WorkspaceGitStatus } from '@goodboy/types';
import { repoNeedsAttention } from './repoNeedsAttention';

const ready = (patch: Partial<WorkspaceGitStatus>): WorkspaceGitStatus => ({
  ...{
    state: 'ready',
    branch: 'main',
    headSubject: 'base',
    upstream: 'origin/main',
    inProgress: null,
    upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
    workingTree: {
      kind: 'known',
      staged: 0,
      unstaged: 0,
      untracked: 0,
      unmerged: 0,
      changed: 0,
    },
  },
  ...patch,
});

describe('a repo that needs attention', () => {
  it('waits for the status before saying anything', () => {
    expect(repoNeedsAttention({ status: null })).toBe(false);
  });

  it('is quiet when up to date, without an upstream or detached', () => {
    expect(repoNeedsAttention({ status: ready({}) })).toBe(false);
    expect(repoNeedsAttention({ status: ready({ upstream: null }) })).toBe(false);
    expect(repoNeedsAttention({ status: ready({ branch: null }) })).toBe(false);
  });

  it('speaks when behind, dirty, diverged, mid rebase or not a usable repository', () => {
    expect(
      repoNeedsAttention({
        status: ready({ upstreamDistance: { kind: 'known', ahead: 0, behind: 2 } }),
      }),
    ).toBe(true);
    expect(
      repoNeedsAttention({
        status: ready({
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
    ).toBe(true);
    expect(
      repoNeedsAttention({
        status: ready({ upstreamDistance: { kind: 'known', ahead: 1, behind: 1 } }),
      }),
    ).toBe(true);
    expect(repoNeedsAttention({ status: ready({ inProgress: 'rebase' }) })).toBe(true);
    expect(repoNeedsAttention({ status: ready({ state: 'absent' }) })).toBe(true);
  });
});
