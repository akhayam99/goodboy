// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, SessionId, SessionProjectMount } from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';

const worktree = vi.hoisted(() => ({
  worktreeChangedFiles: vi.fn(
    async (params: { worktreePath: string; baseBranch?: string | null }) => {
      void params;
      return { paths: ['ledger.ts'], additions: 4, deletions: 1, numstat: '4\t1\tledger.ts' };
    },
  ),
  listBranchCommits: vi.fn(async (worktreePath: string) => {
    void worktreePath;
    return [{ sha: 'abc1234567', shortSha: 'abc1234', subject: 'Round postings' }];
  }),
}));

vi.mock('../worktree/worktree', () => worktree);

import { collectReportDiffEvidence } from './collectReportDiffEvidence';

const SESSION_ID = 'session-ledger' as SessionId;
const MOUNT_ID = 'mount-ledger' as MountId;

type CollectState = Parameters<typeof collectReportDiffEvidence>[0]['state'];

const stateWith = ({
  mountBase,
  projectBase,
}: {
  readonly mountBase: string | null;
  readonly projectBase: string | null;
}): CollectState => {
  const project = aProject({ baseBranch: projectBase });
  const mount: SessionProjectMount = {
    mountId: MOUNT_ID,
    sessionId: SESSION_ID,
    projectId: project.id,
    mountName: 'ledger-core',
    worktreePath: '/w/ledger',
    lastWorktreePath: '/w/ledger',
    repoRoot: '/repo/ledger-core',
    branch: 'ak/fix-rounding',
    baseBranch: mountBase,
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 1,
  };
  return {
    sessions: [aSession({ id: SESSION_ID })],
    sessionMounts: {},
    sessionActiveMount: {},
    projects: [project],
    sessionProjectMounts: { [SESSION_ID]: [mount] },
  };
};

const collect = (state: CollectState) =>
  collectReportDiffEvidence({ state, sessionId: SESSION_ID, mountIds: [MOUNT_ID] });

beforeEach(() => {
  worktree.worktreeChangedFiles.mockClear();
});

describe('collectReportDiffEvidence base branch', () => {
  it('measures and cites the base branch of the mount', async () => {
    const collected = await collect(stateWith({ mountBase: 'develop', projectBase: 'main' }));

    expect(worktree.worktreeChangedFiles).toHaveBeenCalledWith({
      worktreePath: '/w/ledger',
      baseBranch: 'develop',
    });
    expect(collected.evidence?.baseBranch).toBe('develop');
  });

  it('falls back to the project base when the mount has none', async () => {
    const collected = await collect(stateWith({ mountBase: null, projectBase: 'develop' }));

    expect(worktree.worktreeChangedFiles).toHaveBeenCalledWith({
      worktreePath: '/w/ledger',
      baseBranch: 'develop',
    });
    expect(collected.evidence?.baseBranch).toBe('develop');
  });

  it('leaves the base to Rust and never invents main when nothing names one', async () => {
    const collected = await collect(stateWith({ mountBase: null, projectBase: null }));

    expect(worktree.worktreeChangedFiles).toHaveBeenCalledWith({
      worktreePath: '/w/ledger',
      baseBranch: null,
    });
    expect(collected.evidence?.baseBranch).toBeNull();
  });
});
