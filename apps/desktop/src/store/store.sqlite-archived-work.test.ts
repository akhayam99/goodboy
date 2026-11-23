// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertProject,
  insertSessionMount,
  insertWorkspace,
  upsertMountPullRequestLink,
} from '@goodboy/db';
import {
  brandId,
  type MountId,
  type MountPullRequestState,
  type ProjectId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { TEST_NOW } from '@goodboy/types/testing';
import {
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';
import { buildMountRows } from './slices/project-mounts/mountRowModel';
import { settledMountIdsOf } from './slices/project-mounts/workRecord/settledMountIdsOf';
import { listBranchNames } from '../features/worktree/worktree';
vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const PROJECT_ID = brandId<ProjectId>({ value: 'project-payments-api' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-payments-redirect' });
const REPO = '/tmp/payments-api';
const FOLDER = `${REPO}/.goodboy/worktrees/fix-redirect`;
const BRANCH = 'ak/fix-redirect';
const PR_NUMBER = 7;

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });
const project = buildStoryProject({
  id: PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'payments-api',
  rootPath: REPO,
});

let useAppStore: StoryStore;
let sessionId: SessionId;

type LinkParams = {
  readonly state: MountPullRequestState;
};

const seedWork = async ({ state }: LinkParams) => {
  await insertSessionMount({
    db: storySqlite(),
    mount: {
      id: MOUNT_ID,
      sessionId,
      projectId: PROJECT_ID,
      worktreePath: FOLDER,
      lastWorktreePath: null,
      branch: BRANCH,
      baseBranch: 'main',
      parallelIndex: 0,
      mountName: 'payments-api',
      repoSlug: 'harborline/payments-api',
      isAttached: true,
      diskState: 'present',
      revision: 1,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    },
  });
  await upsertMountPullRequestLink({
    db: storySqlite(),
    sessionId,
    link: {
      id: 'link-payments-redirect',
      mountId: MOUNT_ID,
      provider: 'github',
      host: 'github.com',
      repoSlug: 'harborline/payments-api',
      prNumber: PR_NUMBER,
      headBranch: BRANCH,
      baseBranch: 'main',
      url: `https://github.com/harborline/payments-api/pull/${PR_NUMBER}`,
      state,
      snapshot: null,
      mergedHeadSha: null,
      mergedAt: null,
      lastObservedAt: TEST_NOW,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    },
  });
  await useAppStore.getState().loadSessionMounts({ sessionId });
};

type MountRow = {
  readonly worktree_path: string | null;
  readonly is_attached: number;
  readonly branch: string;
};

const mountRow = async (): Promise<MountRow | undefined> =>
  (
    await rowsOf<MountRow>({
      sql: 'SELECT worktree_path, is_attached, branch FROM session_worktrees WHERE id = ?',
      params: [MOUNT_ID],
    })
  )[0];

const linkCount = async (): Promise<number> =>
  (
    await rowsOf<{ readonly id: string }>({
      sql: 'SELECT id FROM mount_pr_links WHERE mount_id = ?',
      params: [MOUNT_ID],
    })
  ).length;

const unmountAndArchive = async () => {
  await useAppStore.getState().detachProject({ sessionId, projectId: PROJECT_ID });
  await useAppStore.getState().archiveTask(sessionId);
};

const shownRows = () =>
  buildMountRows({ state: useAppStore.getState(), sessionId }).flatMap((group) => [
    ...group.rows,
    ...group.finishedRows,
  ]);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project });
  stubStoryInvoke({
    workspaces_with_unread: [],
    workflow_list: [],
    workflows_for_session: [],
    gh_run: () => ({ stdout: '', stderr: 'no remote', exitCode: 1 }),
  });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [project],
    sessions: [],
    archivedSessions: {},
    ...connectedAnthropicState(),
  });
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    goal: 'Fix the payout redirect',
  });
  sessionId = session.id;
});

const restore = async () => {
  storySpies.inspectWorktree.mockResolvedValueOnce({
    kind: 'missing',
    path: FOLDER,
    isMain: false,
    isLocked: false,
    lockReason: null,
  });
  await useAppStore.getState().unarchiveTask(sessionId);
};

describe('store on sqlite: an archived session keeps the work it did', () => {
  it('keeps the branch and its pull request when the worktree folder is removed', async () => {
    await seedWork({ state: 'open' });

    await unmountAndArchive();

    expect(await mountRow()).toEqual({ worktree_path: null, is_attached: 0, branch: BRANCH });
    expect(await linkCount()).toBe(1);
  });

  it('names the branch and the pull request state on the archived page', async () => {
    await seedWork({ state: 'open' });
    await unmountAndArchive();

    await useAppStore.getState().loadSessionWorkRecord({ sessionId });

    const [row] = shownRows();
    expect(row?.branch).toBe(BRANCH);
    expect(row?.request?.label).toBe(`PR #${PR_NUMBER}`);
    expect(row?.request?.state).toBe('open');
  });

  it('brings the worktree back on restore, from the remote when the local branch is gone', async () => {
    await seedWork({ state: 'open' });
    await unmountAndArchive();
    storySpies.createWorktree.mockResolvedValue({
      worktreePath: FOLDER,
      branchName: BRANCH,
      slug: 'fix-redirect',
      reused: false,
      trackedRemote: true,
    });

    await restore();

    expect(storySpies.createWorktree).toHaveBeenCalledWith(
      expect.objectContaining({ existingBranch: BRANCH, fallbackRef: `pull/${PR_NUMBER}/head` }),
    );
    expect(await mountRow()).toEqual({ worktree_path: FOLDER, is_attached: 1, branch: BRANCH });
    expect(await linkCount()).toBe(1);
    expect(
      (useAppStore.getState().sessionProjectMounts[sessionId] ?? []).map((mount) => mount.branch),
    ).toEqual([BRANCH]);
  });

  it('says why when the worktree cannot come back and keeps the record to reopen', async () => {
    await seedWork({ state: 'open' });
    await unmountAndArchive();
    storySpies.createWorktree.mockRejectedValue(new Error(`branch not found: ${BRANCH}`));

    await restore();

    expect(await mountRow()).toEqual({ worktree_path: null, is_attached: 0, branch: BRANCH });
    expect(await linkCount()).toBe(1);
    const titles = (
      await rowsOf<{ readonly title: string }>({
        sql: 'SELECT title FROM notifications WHERE session_id = ?',
        params: [sessionId],
      })
    ).map((notification) => notification.title);
    expect(titles).toContain(
      `Couldn't bring back ${BRANCH} in payments-api. Reopen it from the overview.`,
    );
  });

  it('attaches the kept row again on Undo of the unmount, with no second mount', async () => {
    await seedWork({ state: 'open' });
    await useAppStore.getState().detachProject({ sessionId, projectId: PROJECT_ID });
    storySpies.createWorktree.mockResolvedValue({
      worktreePath: FOLDER,
      branchName: BRANCH,
      slug: 'fix-redirect',
      reused: false,
    });
    storySpies.inspectWorktree.mockResolvedValueOnce({
      kind: 'missing',
      path: FOLDER,
      isMain: false,
      isLocked: false,
      lockReason: null,
    });

    await useAppStore
      .getState()
      .attachMount({ sessionId, mountId: MOUNT_ID, canFetchRemote: true });

    expect(await mountRow()).toEqual({ worktree_path: FOLDER, is_attached: 1, branch: BRANCH });
    expect(
      await rowsOf({
        sql: 'SELECT id FROM session_worktrees WHERE session_id = ?',
        params: [sessionId],
      }),
    ).toHaveLength(1);
  });

  it('leaves merged work closed on restore and still shows its branch and pull request', async () => {
    await seedWork({ state: 'merged' });
    await unmountAndArchive();

    await restore();

    expect(storySpies.createWorktree).not.toHaveBeenCalled();
    expect(await mountRow()).toEqual({ worktree_path: null, is_attached: 0, branch: BRANCH });
    const [row] = shownRows();
    expect(row?.branch).toBe(BRANCH);
    expect(row?.request?.state).toBe('merged');
  });

  it('restores the newest pull request when two were observed in the same refresh', async () => {
    await seedWork({ state: 'merged' });
    await upsertMountPullRequestLink({
      db: storySqlite(),
      sessionId,
      link: {
        id: 'link-payments-redirect-next',
        mountId: MOUNT_ID,
        provider: 'github',
        host: 'github.com',
        repoSlug: 'harborline/payments-api',
        prNumber: PR_NUMBER + 1,
        headBranch: BRANCH,
        baseBranch: 'main',
        url: `https://github.com/harborline/payments-api/pull/${PR_NUMBER + 1}`,
        state: 'open',
        snapshot: null,
        mergedHeadSha: null,
        mergedAt: null,
        lastObservedAt: TEST_NOW,
        createdAt: '2026-11-23T12:00:00.000Z' as typeof TEST_NOW,
        updatedAt: TEST_NOW,
      },
    });
    await unmountAndArchive();
    storySpies.createWorktree.mockResolvedValue({
      worktreePath: FOLDER,
      branchName: BRANCH,
      slug: 'fix-redirect',
      reused: false,
    });

    await restore();

    expect(storySpies.createWorktree).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackRef: `pull/${PR_NUMBER + 1}/head` }),
    );
    expect(shownRows()[0]?.request?.label).toBe(`PR #${PR_NUMBER + 1}`);
  });

  it('keeps the recorded branch checked out when it still exists locally', async () => {
    await seedWork({ state: 'open' });
    await unmountAndArchive();
    vi.mocked(listBranchNames).mockResolvedValueOnce([BRANCH]);
    storySpies.createWorktree.mockResolvedValue({
      worktreePath: FOLDER,
      branchName: BRANCH,
      slug: 'fix-redirect',
      reused: false,
    });

    await restore();

    expect(storySpies.createWorktree).toHaveBeenCalledWith(
      expect.not.objectContaining({ fallbackRef: expect.anything() }),
    );
    expect(await mountRow()).toEqual({ worktree_path: FOLDER, is_attached: 1, branch: BRANCH });
  });

  it('stops offering a review of merged work after its branch is unmounted', async () => {
    await seedWork({ state: 'merged' });
    await useAppStore.getState().loadSessionWorkRecord({ sessionId });

    await useAppStore.getState().detachProject({ sessionId, projectId: PROJECT_ID });

    expect(settledMountIdsOf({ state: useAppStore.getState(), sessionId })).toEqual([MOUNT_ID]);
  });
});
