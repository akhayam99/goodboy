import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertProject, insertWorkspace } from '@goodboy/db';
import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
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
  stubStoryInvoke,
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

const HARBORLINE_ID = 'workspace-harborline' as WorkspaceId;
const NORTHWIND_ID = 'workspace-northwind' as WorkspaceId;
const LEDGER_ID = 'project-ledger-core' as ProjectId;
const RELAY_ID = 'project-notify-relay' as ProjectId;

const harborline = buildStoryWorkspace({
  id: HARBORLINE_ID,
  name: 'Harborline',
  slug: 'harborline',
});
const northwind = buildStoryWorkspace({ id: NORTHWIND_ID, name: 'Northwind', slug: 'northwind' });
const ledger = buildStoryProject({
  id: LEDGER_ID,
  workspaceId: HARBORLINE_ID,
  name: 'ledger-core',
  rootPath: '/tmp/ledger-core',
});
const relay = buildStoryProject({
  id: RELAY_ID,
  workspaceId: HARBORLINE_ID,
  name: 'notify-relay',
  rootPath: '/tmp/notify-relay',
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ gh_run: { stdout: '', stderr: 'no git remotes found', exitCode: 1 } });
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: harborline });
  await insertWorkspace({ db, workspace: northwind });
  await insertProject({ db, project: ledger });
  await insertProject({ db, project: relay });
  useAppStore.setState({
    workspaces: [harborline, northwind],
    currentWorkspaceId: HARBORLINE_ID,
    projects: [ledger, relay],
    sessions: [],
    archivedSessions: {},
  });
});

const projectWorkspaces = () =>
  rowsOf<{ id: string; workspace_id: string; disconnected_at: number | null }>({
    sql: 'SELECT id, workspace_id, disconnected_at FROM projects ORDER BY id',
  });

const storedProjectIds = () => useAppStore.getState().projects.map((project) => project.id);

describe('store on sqlite: projects', () => {
  it('addProject writes the row and the store entry together', async () => {
    const result = await useAppStore.getState().addProject({
      workspaceId: HARBORLINE_ID,
      rootPath: '/tmp/storefront-web',
      name: 'storefront-web',
    });

    expect(result.kind).toBe('linked');
    const rows = await rowsOf<{ name: string }>({
      sql: "SELECT name FROM projects WHERE name = 'storefront-web'",
    });
    expect(rows).toHaveLength(1);
    expect(useAppStore.getState().projects.map((project) => project.name)).toContain(
      'storefront-web',
    );
  });

  it('addProject leaves the store alone when the row cannot be written', async () => {
    injectDbFault({ match: /INSERT INTO projects/, message: 'disk full' });

    await expect(
      useAppStore
        .getState()
        .addProject({ workspaceId: HARBORLINE_ID, rootPath: '/tmp/storefront-web' }),
    ).rejects.toThrow('disk full');

    expect((await projectWorkspaces()).map((row) => row.id)).toEqual([LEDGER_ID, RELAY_ID]);
    expect(storedProjectIds()).toEqual([LEDGER_ID, RELAY_ID]);
  });

  it('removeProject keeps the project connected in the row and the store when the write fails', async () => {
    injectDbFault({ match: /UPDATE projects SET disconnected_at/, message: 'disk full' });

    await expect(useAppStore.getState().removeProject({ projectId: RELAY_ID })).rejects.toThrow(
      'disk full',
    );

    expect((await projectWorkspaces()).map((row) => row.disconnected_at)).toEqual([null, null]);
    expect(storedProjectIds()).toEqual([LEDGER_ID, RELAY_ID]);
  });
});

describe('store on sqlite: adopting a project into another workspace', () => {
  const startSessionOnLedger = async () => {
    const { session } = await useAppStore.getState().createSession({
      workspaceId: HARBORLINE_ID,
      projectId: LEDGER_ID,
      goal: 'Reconcile the Harborline ledger export',
    });
    return session.id as SessionId;
  };

  const sessionWorkspace = (sessionId: SessionId) =>
    rowsOf<{ workspace_id: string }>({
      sql: 'SELECT workspace_id FROM sessions WHERE id = ?',
      params: [sessionId],
    });

  it('moves the project and its session in one step', async () => {
    const sessionId = await startSessionOnLedger();

    const result = await useAppStore
      .getState()
      .adoptProject({ projectId: LEDGER_ID, targetWorkspaceId: NORTHWIND_ID });

    expect(result).toMatchObject({ movedSessionCount: 1, mergedWorkspace: false });
    expect((await projectWorkspaces()).find((row) => row.id === LEDGER_ID)?.workspace_id).toBe(
      NORTHWIND_ID,
    );
    expect(await sessionWorkspace(sessionId)).toEqual([{ workspace_id: NORTHWIND_ID }]);
    expect(
      useAppStore.getState().projects.find((project) => project.id === LEDGER_ID)?.workspaceId,
    ).toBe(NORTHWIND_ID);
  });

  it('moves nothing when the last statement of the move fails', async () => {
    const sessionId = await startSessionOnLedger();
    injectDbFault({ match: /UPDATE permission_rules SET workspace_id/, message: 'disk full' });

    await expect(
      useAppStore
        .getState()
        .adoptProject({ projectId: LEDGER_ID, targetWorkspaceId: NORTHWIND_ID }),
    ).rejects.toThrow();

    expect((await projectWorkspaces()).find((row) => row.id === LEDGER_ID)?.workspace_id).toBe(
      HARBORLINE_ID,
    );
    expect(await sessionWorkspace(sessionId)).toEqual([{ workspace_id: HARBORLINE_ID }]);
    expect(
      useAppStore.getState().projects.find((project) => project.id === LEDGER_ID)?.workspaceId,
    ).toBe(HARBORLINE_ID);
  });
});

describe('store on sqlite: mounting a project in a session', () => {
  const startBareSession = async () => {
    const { session } = await useAppStore.getState().createSession({
      workspaceId: HARBORLINE_ID,
      goal: 'Reconcile the Harborline ledger export',
    });
    return session.id as SessionId;
  };

  const mountRows = (sessionId: SessionId) =>
    rowsOf<{ project_id: string }>({
      sql: 'SELECT project_id FROM session_worktrees WHERE session_id = ?',
      params: [sessionId],
    });

  const materializedEvents = (sessionId: SessionId) =>
    rowsOf<{ kind: string }>({
      sql: "SELECT kind FROM session_events WHERE session_id = ? AND kind = 'project_materialized'",
      params: [sessionId],
    });

  it('ensureProjectMounted writes the mount row and the store mount together', async () => {
    const sessionId = await startBareSession();

    const result = await useAppStore.getState().ensureProjectMounted({
      sessionId,
      projectId: LEDGER_ID,
      reason: 'the session works in this project',
    });

    expect(result.status).toBe('created');
    expect(await mountRows(sessionId)).toEqual([{ project_id: LEDGER_ID }]);
    expect(await materializedEvents(sessionId)).toHaveLength(1);
    expect(
      useAppStore.getState().sessionProjectMounts[sessionId]?.map((mount) => mount.projectId),
    ).toEqual([LEDGER_ID]);
  });

  it('ensureProjectMounted records no mount anywhere when the mount row cannot be written', async () => {
    const sessionId = await startBareSession();
    injectDbFault({ match: /INSERT INTO session_worktrees/, message: 'disk full' });

    await expect(
      useAppStore.getState().ensureProjectMounted({
        sessionId,
        projectId: LEDGER_ID,
        reason: 'the session works in this project',
      }),
    ).rejects.toThrow();

    expect(storySpies.createWorktree).toHaveBeenCalledTimes(1);
    expect(await mountRows(sessionId)).toEqual([]);
    expect(await materializedEvents(sessionId)).toEqual([]);
    expect(useAppStore.getState().sessionProjectMounts[sessionId] ?? []).toEqual([]);
    expect(useAppStore.getState().sessionWorktrees[sessionId] ?? []).toEqual([]);
  });
});
