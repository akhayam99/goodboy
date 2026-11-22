// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertProject, insertSessionMount, insertWorkspace } from '@goodboy/db';
import {
  brandId,
  type MountId,
  type ProjectId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import {
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  openStorySqlite,
  storySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { TEST_NOW } from '@goodboy/types/testing';
import type { ActionEnv } from '../types';
import { MOUNT_KIND } from './mount';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../chat/turn', async () =>
  (await import('../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../permissions/permissions', async () =>
  (await import('../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../providers/providers', async () =>
  (await import('../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../providers/routing', async () =>
  (await import('../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../budget/budget', async () =>
  (await import('../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../worktree/worktree', async () =>
  (await import('../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../plans/plans', async () =>
  (await import('../../../store/storyHarness')).plansModuleMock(),
);

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const PROJECT_ID = brandId<ProjectId>({ value: 'project-ledger-core' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-ledger-export' });
const FOLDER = '/tmp/ledger-core/.goodboy/worktrees/ledger-export';
const AT = TEST_NOW;

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });
const project = buildStoryProject({
  id: PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: '/tmp/ledger-core',
});

let useAppStore: StoryStore;
let sessionId: SessionId;
const showToast = vi.fn();

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast,
  copyText: async () => undefined,
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  showToast.mockReset();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project });
  stubStoryInvoke({
    workspaces_with_unread: [],
    workflow_list: [],
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
    goal: 'Reconcile the ledger export',
  });
  sessionId = session.id;
});

type ClosedParams = {
  readonly diskState: 'present' | 'removed';
};

const seedClosedBranch = async ({ diskState }: ClosedParams) => {
  await insertSessionMount({
    db: storySqlite(),
    mount: {
      id: MOUNT_ID,
      sessionId,
      projectId: PROJECT_ID,
      worktreePath: null,
      lastWorktreePath: FOLDER,
      branch: 'goodboy/ledger-export',
      baseBranch: 'main',
      parallelIndex: 1,
      mountName: 'ledger-core',
      repoSlug: null,
      isAttached: false,
      diskState,
      revision: 3,
      createdAt: AT,
      updatedAt: AT,
    },
  });
  await useAppStore.getState().loadSessionMounts({ sessionId });
};

const rows = () => useAppStore.getState().sessionMounts[sessionId] ?? [];

const runAction = async ({ id }: { readonly id: string }) => {
  const facts = MOUNT_KIND.facts({
    state: useAppStore.getState(),
    target: { kind: 'mount', sessionId, mountId: MOUNT_ID, status: null, remoteKind: null },
  });
  const action = MOUNT_KIND.actions.find((candidate) => candidate.id === id);
  if (facts === null || action === undefined) {
    throw new Error(`no ${id} for the closed branch`);
  }
  await action.run({ facts, env, choice: null });
};

const undo = () => useAppStore.getState().undoLastOperation();

describe('Unmount a closed or deleted branch, then Undo', () => {
  it('Undo puts the closed branch back as it was', async () => {
    await seedClosedBranch({ diskState: 'removed' });

    await runAction({ id: 'mount.forget' });
    expect(rows()).toHaveLength(0);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Unmounted goodboy/ledger-export.' }),
    );

    expect(await undo()).toBe(true);

    expect(rows()).toEqual([
      expect.objectContaining({ id: MOUNT_ID, branch: 'goodboy/ledger-export', isAttached: false }),
    ]);
  });

  it('Undo of a deleted branch brings back the row and says the folder stays removed', async () => {
    await seedClosedBranch({ diskState: 'present' });

    await runAction({ id: 'mount.removeGone' });
    expect(storySpies.removeWorktreeChecked).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: FOLDER }),
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unmounted goodboy/ledger-export and removed its folder.',
      }),
    );

    expect(await undo()).toBe(true);

    expect(rows()).toEqual([expect.objectContaining({ id: MOUNT_ID, diskState: 'removed' })]);
  });

  it('Undo refuses once the session is gone', async () => {
    await seedClosedBranch({ diskState: 'removed' });
    await runAction({ id: 'mount.forget' });
    useAppStore.setState({ sessions: [] });

    expect(await undo()).toBe(false);
  });

  it('Undo that already landed does not add the row twice', async () => {
    await seedClosedBranch({ diskState: 'removed' });
    await runAction({ id: 'mount.forget' });
    const [operation] = useAppStore.getState().undoStack;

    expect(await operation?.undo()).toBe(true);
    expect(await undo()).toBe(true);

    expect(rows()).toHaveLength(1);
  });
});
