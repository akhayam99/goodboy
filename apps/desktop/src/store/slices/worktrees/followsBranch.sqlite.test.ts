// @vitest-environment node

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);
const status: { current: unknown } = vi.hoisted(() => ({ current: null }));
vi.mock('../../../features/worktree/worktree', async () => ({
  ...(await import('../../storyHarness')).worktreeModuleMock(),
  worktreeStatus: async () => status.current,
  worktreeBranchHolder: async () => null,
}));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertProject,
  insertSession,
  insertSessionMount,
  insertWorkspace,
  listSessionMounts,
} from '@goodboy/db';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  SessionId,
  WorkspaceId,
  WorktreeStatus,
} from '@goodboy/types';
import { aSession, TEST_NOW } from '@goodboy/types/testing';
import { brandedId } from '../../../features/history/testing/brandedId';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryProject,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySpies,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';

type CreateWorktreeParams = {
  dirName: string;
  branchName: string;
};

const NOW: IsoDateTime = TEST_NOW;
const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const PROJECT_ID = brandedId<ProjectId>({ value: 'project-ledger-core' });
const SESSION_ID = brandedId<SessionId>({ value: 'session-flow-split' });
const MOUNT_ID = brandedId<MountId>({ value: 'mount-flow' });
const WORKTREE = '/repo/ledger-core/.goodboy/worktrees/flow';
const ROOT = '/repo/ledger-core';

const ghRuns: Array<string> = [];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type StatusParams = {
  readonly branch: string;
  readonly inProgress?: 'rebase' | null;
};

const statusOn = ({ branch, inProgress = null }: StatusParams): WorktreeStatus => ({
  branch,
  head: 'aaaaaaa1',
  headSubject: 'base',
  upstream: null,
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  mainDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  inProgress,
});

const storedBranches = async () =>
  (await listSessionMounts({ db: storySqlite(), sessionId: SESSION_ID })).map((row) => row.branch);

type ReconcileParams = {
  readonly branch: string;
};
const reconcile = async ({ branch }: ReconcileParams) => {
  await useAppStore.getState().reconcileSessionBranch({
    sessionId: SESSION_ID,
    mountId: MOUNT_ID,
    worktreePath: WORKTREE,
    observedBranch: branch,
  });
};

beforeEach(async () => {
  await resetStoryStore();
  status.current = statusOn({ branch: 'ak/session' });
  const db = await openStorySqlite();
  const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline' });
  const project = buildStoryProject({
    id: PROJECT_ID,
    workspaceId: WORKSPACE_ID,
    name: 'ledger-core',
    kind: 'repo',
    rootPath: ROOT,
  });
  const session = aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID });
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project });
  await insertSession(db, session);
  await insertSessionMount({
    db,
    mount: {
      id: MOUNT_ID,
      sessionId: SESSION_ID,
      projectId: PROJECT_ID,
      worktreePath: WORKTREE,
      lastWorktreePath: WORKTREE,
      branch: 'ak/session',
      baseBranch: 'main',
      parallelIndex: 0,
      mountName: 'ledger-core',
      repoSlug: 'harborline/ledger-core',
      isAttached: true,
      diskState: 'present',
      revision: 0,
      branchOrigin: 'created',
      createdAt: NOW,
      updatedAt: NOW,
    },
  });
  ghRuns.length = 0;
  stubStoryInvoke({
    detect_editors: () => [],
    gh_run: (args: unknown) => {
      ghRuns.push(JSON.stringify(args));
      return '[]';
    },
  });
  useAppStore.setState({
    sessions: [session],
    projects: [project],
    workspaces: [workspace],
    sessionBranches: { [SESSION_ID]: 'ak/session' },
    loadPrSeries: async () => [],
    loadMountCleanupProposals: async () => [],
  });
  await useAppStore.getState().loadSessionMounts({ sessionId: SESSION_ID });
});

describe('a mount follows the branch its worktree is on', () => {
  it('takes the new name when the mounted branch is renamed outside the app', async () => {
    status.current = statusOn({ branch: 'ak/flow-split' });

    await reconcile({ branch: 'ak/flow-split' });

    expect(await storedBranches()).toEqual(['ak/flow-split']);
    expect(useAppStore.getState().mountBranchObservations[SESSION_ID] ?? []).toEqual([]);
    expect(useAppStore.getState().sessionBranches[SESSION_ID]).toBe('ak/flow-split');
    await vi.waitFor(() => expect(ghRuns.some((run) => run.includes('ak/flow-split'))).toBe(true));
  });

  it('keeps the note and the old name while a rebase is in progress', async () => {
    status.current = statusOn({ branch: 'ak/flow-split', inProgress: 'rebase' });

    await reconcile({ branch: 'ak/flow-split' });

    expect(await storedBranches()).toEqual(['ak/session']);
    expect(useAppStore.getState().mountBranchObservations[SESSION_ID]).toEqual([
      expect.objectContaining({ state: 'mismatch', observedBranch: 'ak/flow-split' }),
    ]);
  });

  it('splits into a second mount under the branch prefix', async () => {
    storySpies.createWorktree.mockImplementation(
      async ({ dirName, branchName }: CreateWorktreeParams) => {
        return {
          worktreePath: `${ROOT}/.goodboy/worktrees/${dirName}`,
          branchName,
          slug: dirName,
          reused: false,
        };
      },
    );

    const second = await useAppStore.getState().forkMount({
      sessionId: SESSION_ID,
      projectId: PROJECT_ID,
      branch: 'feat/flow-split',
    });

    expect(second.branch).toMatch(/^[^/]+\/feat-flow-split$/);
    expect(second.branch).not.toBe('feat/flow-split');
    expect(await storedBranches()).toHaveLength(2);
  });
});
