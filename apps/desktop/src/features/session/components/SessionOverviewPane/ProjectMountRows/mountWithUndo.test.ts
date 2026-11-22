// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertProject, insertWorkspace, updateSessionMountBranch } from '@goodboy/db';
import type { Project, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { TEST_NOW } from '@goodboy/types/testing';
import { brandedId } from '../../../../history/testing/brandedId';
import { mountWithUndo } from './mountWithUndo';
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
} from '../../../../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../../chat/turn', async () =>
  (await import('../../../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../../../permissions/permissions', async () =>
  (await import('../../../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../../providers/providers', async () =>
  (await import('../../../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../../providers/routing', async () =>
  (await import('../../../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../../budget/budget', async () =>
  (await import('../../../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../../worktree/worktree', async () =>
  (await import('../../../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../../../shared/lib/repo', async () =>
  (await import('../../../../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../../../plans/plans', async () =>
  (await import('../../../../../store/storyHarness')).plansModuleMock(),
);

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const REPO_ID = brandedId<ProjectId>({ value: 'project-ledger-core' });
const FOLDER_ID = brandedId<ProjectId>({ value: 'project-acme-docs' });

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });
const repo = buildStoryProject({
  id: REPO_ID,
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: '/tmp/ledger-core',
});
const folder = buildStoryProject({
  id: FOLDER_ID,
  workspaceId: WORKSPACE_ID,
  name: 'acme-docs',
  rootPath: '/tmp/acme-docs',
  kind: 'folder',
});

let useAppStore: StoryStore;
let sessionId: SessionId;
const showToast = vi.fn();

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  showToast.mockReset();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project: repo });
  await insertProject({ db, project: folder });
  stubStoryInvoke({
    workspaces_with_unread: [],
    workflow_list: [],
    gh_run: () => ({ stdout: '', stderr: 'no remote', exitCode: 1 }),
  });
  storySpies.createWorktree.mockResolvedValue({
    worktreePath: '/tmp/ledger-core/.goodboy/worktrees/ledger-export',
    branchName: 'goodboy/ledger-export',
    slug: 'ledger-export',
    reused: false,
  });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [repo, folder],
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

const mount = ({ project, isAdded }: { readonly project: Project; readonly isAdded: boolean }) =>
  mountWithUndo({
    sessionId,
    project,
    isAdded,
    options: {},
    getState: useAppStore.getState,
    showToast,
  });

const viewsOf = async ({ projectId }: { readonly projectId: ProjectId }) =>
  (await useAppStore.getState().loadSessionMounts({ sessionId })).filter(
    (view) => view.projectId === projectId,
  );

const undo = () => useAppStore.getState().undoLastOperation();

describe('mountWithUndo', () => {
  it('Undo removes the mount this request created', async () => {
    await mount({ project: repo, isAdded: false });
    expect(await viewsOf({ projectId: REPO_ID })).toHaveLength(1);

    expect(await undo()).toBe(true);

    expect(await viewsOf({ projectId: REPO_ID })).toHaveLength(0);
  });

  it('offers no Undo when the project was already mounted', async () => {
    await mount({ project: repo, isAdded: false });
    const stack = useAppStore.getState().undoStack.length;

    await mount({ project: repo, isAdded: false });

    expect(useAppStore.getState().undoStack).toHaveLength(stack);
    expect(showToast).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ action: expect.anything() }),
    );
  });

  it('offers no Undo for a plain folder that works in place', async () => {
    await mount({ project: folder, isAdded: false });

    expect(useAppStore.getState().undoStack).toHaveLength(0);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Mounted acme-docs') }),
    );
  });

  it('refuses when the created mount changed since', async () => {
    await mount({ project: repo, isAdded: false });
    const [view] = await viewsOf({ projectId: REPO_ID });
    if (view === undefined) {
      throw new Error('the mount was not created');
    }
    await updateSessionMountBranch({
      db: storySqlite(),
      sessionId,
      mountId: view.id,
      branch: 'goodboy/ledger-rename',
      expectedRevision: view.revision,
      updatedAt: TEST_NOW,
    });
    await useAppStore.getState().loadSessionMounts({ sessionId });

    expect(await undo()).toBe(false);

    expect(await viewsOf({ projectId: REPO_ID })).toHaveLength(1);
  });

  it('leaves a replacement mount alone after the original was unmounted', async () => {
    await mount({ project: repo, isAdded: false });
    await useAppStore.getState().detachProject({ sessionId, projectId: REPO_ID });
    await useAppStore
      .getState()
      .ensureProjectMounted({ sessionId, projectId: REPO_ID, reason: 'mounted again' });

    expect(await undo()).toBe(false);

    expect(await viewsOf({ projectId: REPO_ID })).toHaveLength(1);
  });

  it('keeps the mount and the Undo when the worktree holds uncommitted changes', async () => {
    await mount({ project: repo, isAdded: true });
    const dirty = {
      kind: 'kept',
      path: '/tmp/ledger-core/.goodboy/worktrees/ledger-export',
      reasons: ['uncommitted changes'],
    };
    storySpies.removeWorktreeChecked.mockResolvedValueOnce(dirty);

    expect(await undo()).toBe(false);

    expect((await viewsOf({ projectId: REPO_ID }))[0]?.isAttached).toBe(true);
    expect(useAppStore.getState().projects.some((project) => project.id === REPO_ID)).toBe(true);
    expect(useAppStore.getState().undoStack).toHaveLength(1);
  });

  it('retries only the workspace removal after it failed once', async () => {
    await mount({ project: repo, isAdded: true });
    const removeProject = useAppStore.getState().removeProject;
    useAppStore.setState({
      removeProject: vi.fn(async () => {
        throw new Error('the database is busy');
      }),
    });

    expect(await undo()).toBe(false);
    expect(await viewsOf({ projectId: REPO_ID })).toHaveLength(0);

    useAppStore.setState({ removeProject });
    expect(await undo()).toBe(true);

    expect(useAppStore.getState().projects.some((project) => project.id === REPO_ID)).toBe(false);
  });

  it('keeps an added folder in the workspace once another session uses it', async () => {
    await mount({ project: folder, isAdded: true });
    const { session: other } = await useAppStore.getState().createSession({
      workspaceId: WORKSPACE_ID,
      goal: 'Write the docs',
    });
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === other.id ? { ...session, activeProjectId: FOLDER_ID } : session,
      ),
    }));

    expect(await undo()).toBe(false);

    expect(useAppStore.getState().projects.some((project) => project.id === FOLDER_ID)).toBe(true);
  });
});
