import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertProject, insertWorkspace } from '@goodboy/db';
import type { ProjectId, SessionId, WorkflowId, WorkspaceId } from '@goodboy/types';
import {
  buildStoryProject,
  buildStoryWorkspace,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  type StoryStore,
} from './storyHarness';

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
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const PROJECT_ID = 'project-ledger-core' as ProjectId;

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });
const project = buildStoryProject({
  id: PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: '/tmp/ledger-core',
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [project],
    sessions: [],
    archivedSessions: {},
  });
});

const sessionRows = () => rowsOf<{ id: string }>({ sql: 'SELECT id FROM sessions' });

describe('store on sqlite: createSession', () => {
  it('writes the session row and the store entry together', async () => {
    const { session } = await useAppStore.getState().createSession({
      workspaceId: WORKSPACE_ID,
      goal: 'Reconcile the Harborline ledger export',
    });

    expect((await sessionRows()).map((row) => row.id)).toEqual([session.id]);
    expect(useAppStore.getState().sessions.map((entry) => entry.id)).toEqual([session.id]);
    const slots = await rowsOf<{ key: string; value: string }>({
      sql: 'SELECT key, value FROM context_slots WHERE session_id = ?',
      params: [session.id],
    });
    expect(slots).toEqual([{ key: 'goal', value: 'Reconcile the Harborline ledger export' }]);
  });
});

describe('store on sqlite: a write that fails halfway', () => {
  it('createSession leaves no session row when the workflow run row is rejected', async () => {
    await expect(
      useAppStore.getState().createSession({
        workspaceId: WORKSPACE_ID,
        goal: 'Reconcile the Harborline ledger export',
        workflowId: 'workflow-not-in-the-db' as WorkflowId,
      }),
    ).rejects.toThrow();

    expect(await sessionRows()).toEqual([]);
    expect(useAppStore.getState().sessions).toEqual([]);
  });

  it('createSession discards the session when the project mount fails', async () => {
    storySpies.createWorktree.mockRejectedValue(new Error('git worktree add failed'));

    await expect(
      useAppStore.getState().createSession({
        workspaceId: WORKSPACE_ID,
        projectId: PROJECT_ID,
        goal: 'Reconcile the Harborline ledger export',
      }),
    ).rejects.toThrow('git worktree add failed');

    expect(await sessionRows()).toEqual([]);
    expect(useAppStore.getState().sessions).toEqual([]);
    expect(useAppStore.getState().currentSessionId).toBeNull();
  });

  it('createSession keeps the row and the store entry in step when the goal slot fails', async () => {
    injectDbFault({ match: /INSERT INTO context_slots/, message: 'disk full' });

    await expect(
      useAppStore.getState().createSession({
        workspaceId: WORKSPACE_ID,
        goal: 'Reconcile the Harborline ledger export',
      }),
    ).rejects.toThrow('disk full');

    const stored = (await sessionRows()).map((row) => row.id);
    const listed = useAppStore.getState().sessions.map((entry) => entry.id);
    expect(listed).toEqual(stored);
  });
});

const createLiveSession = async () => {
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    goal: 'Reconcile the Harborline ledger export',
  });
  return session.id as SessionId;
};

const goalSlots = (sessionId: SessionId) =>
  rowsOf<{ key: string }>({
    sql: 'SELECT key FROM context_slots WHERE session_id = ?',
    params: [sessionId],
  });

const sessionFlags = (sessionId: SessionId) =>
  rowsOf<{ archived_at: number | null; deleted_at: number | null }>({
    sql: 'SELECT archived_at, deleted_at FROM sessions WHERE id = ?',
    params: [sessionId],
  });

describe('store on sqlite: deleting a session', () => {
  it('purges the rows and drops the session from the store', async () => {
    const sessionId = await createLiveSession();

    await useAppStore.getState().deleteTask(sessionId);

    expect(await goalSlots(sessionId)).toEqual([]);
    expect((await sessionFlags(sessionId))[0]?.deleted_at).not.toBeNull();
    expect(useAppStore.getState().sessions.map((entry) => entry.id)).toEqual([]);
  });

  it('keeps every row and the store entry when the purge fails on its last statement', async () => {
    const sessionId = await createLiveSession();
    injectDbFault({ match: /UPDATE sessions SET deleted_at/, message: 'disk full' });

    await expect(useAppStore.getState().deleteTask(sessionId)).rejects.toThrow();

    expect(await goalSlots(sessionId)).toEqual([{ key: 'goal' }]);
    expect((await sessionFlags(sessionId))[0]?.deleted_at).toBeNull();
    expect(useAppStore.getState().sessions.map((entry) => entry.id)).toEqual([sessionId]);
  });
});

describe('store on sqlite: archiving a session', () => {
  it('moves the session to the archive in the row and the store', async () => {
    const sessionId = await createLiveSession();

    await useAppStore.getState().archiveTask(sessionId);

    expect((await sessionFlags(sessionId))[0]?.archived_at).not.toBeNull();
    expect(useAppStore.getState().sessions).toEqual([]);
    expect(useAppStore.getState().archivedSessions[WORKSPACE_ID]?.map((entry) => entry.id)).toEqual(
      [sessionId],
    );
  });

  it('puts the session back in the store when the archive write fails', async () => {
    const sessionId = await createLiveSession();
    injectDbFault({ match: /UPDATE sessions SET archived_at/, message: 'disk full' });

    await expect(useAppStore.getState().archiveTask(sessionId)).rejects.toThrow('disk full');

    expect((await sessionFlags(sessionId))[0]?.archived_at).toBeNull();
    expect(useAppStore.getState().sessions.map((entry) => entry.id)).toEqual([sessionId]);
    expect(useAppStore.getState().archivedSessions[WORKSPACE_ID] ?? []).toEqual([]);
  });
});
