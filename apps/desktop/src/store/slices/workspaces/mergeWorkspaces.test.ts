// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  Project,
  ProjectId,
  SessionContextItem,
  SessionContextItemId,
  SessionId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import type { AppStore } from '../../store';
import { openStorySqlite, rowsOf, storySqlite } from '../../../test/sqliteDb';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  workspacesAtPrune: [] as ReadonlyArray<string>,
  pruneChatImages: vi.fn(async () => undefined),
}));

vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../test/sqliteDb')).sqliteDbLibModuleMock(),
);
vi.mock('../../../features/workspace-chat/pruneChatImages', () => ({
  pruneChatImages: h.pruneChatImages,
}));

import { mergeWorkspaces } from './mergeWorkspaces';

const NOW = '2026-08-22T00:00:00.000Z' as IsoDateTime;
const TARGET = 'ws-target' as WorkspaceId;
const SOURCE = 'ws-source' as WorkspaceId;

const overrides = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
  defaultBranchTemplate: null,
} as const;

const workspace = (id: WorkspaceId, name: string): Workspace => ({
  id,
  name,
  slug: name,
  overrides,
  createdAt: NOW,
  updatedAt: NOW,
});

const project = (id: string, workspaceId: WorkspaceId): Project => ({
  id: id as ProjectId,
  workspaceId,
  name: id,
  rootPath: `/repos/${id}`,
  kind: 'repo',
  overrides,
  createdAt: NOW,
  updatedAt: NOW,
});

type Harness = {
  state: AppStore;
  set: SetFn;
  get: GetFn;
};

const harness = (initial: Record<string, unknown>): Harness => {
  let state = {
    workspaces: [workspace(TARGET, 'target'), workspace(SOURCE, 'source')],
    projects: [project('proj-t', TARGET), project('proj-s', SOURCE)],
    currentWorkspaceId: null,
    archivedSessions: { [SOURCE]: [] },
    sessionContextItems: { [SESSION]: [cachedItem('learn-live')] },
    workspaceLearnings: { [SOURCE]: [cachedItem('learn-live')] },
    workspaceExternalTasks: { [SOURCE]: [] },
    workspaceIntegrations: { [SOURCE]: [] },
    projectScripts: {},
    workspaceOverrides: { [SOURCE]: overrides },
    setCurrentWorkspace: vi.fn(async () => undefined),
    emitNotification: vi.fn(async () => undefined),
    ...initial,
  } as unknown as AppStore;
  const set: SetFn = (update) => {
    const patch = typeof update === 'function' ? update(state) : update;
    state = { ...state, ...patch };
  };
  return {
    get state() {
      return state;
    },
    set,
    get: () => state,
  };
};

const MS = Date.parse(NOW);
const SESSION = 'sess-source' as SessionId;

const seedDb = async () => {
  const db = await openStorySqlite();
  for (const id of [TARGET, SOURCE]) {
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, id, id, MS, MS],
    );
  }
  for (const [id, workspaceId] of [
    ['proj-t', TARGET],
    ['proj-s', SOURCE],
  ] as const) {
    await db.execute(
      `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'repo', ?, ?)`,
      [id, workspaceId, id, `/repos/${id}`, MS, MS],
    );
  }
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES (?, ?, 'goal', 'idle', ?, ?)`,
    [SESSION, SOURCE, MS, MS],
  );
  for (const [id, sessionId] of [
    ['learn-live', SESSION],
    ['learn-orphan', null],
  ] as const) {
    await db.execute(
      `INSERT INTO session_context_items
         (id, session_id, workspace_id, kind, title, text, created_at, updated_at)
       VALUES (?, ?, ?, 'learning', ?, 'text', ?, ?)`,
      [id, sessionId, SOURCE, id, MS, MS],
    );
  }
  await db.execute(
    `INSERT INTO workspace_external_tasks
       (workspace_id, provider, external_id, identifier, url, title, created_at)
     VALUES (?, 'linear', 'NW-7', 'NW-7', 'https://linear.example/NW-7', 'Ledger export', ?)`,
    [SOURCE, MS],
  );
};

const cachedItem = (id: string): SessionContextItem => ({
  id: id as SessionContextItemId,
  sessionId: SESSION,
  workspaceId: SOURCE,
  kind: 'learning',
  title: id,
  text: 'text',
  topic: null,
  source: null,
  audience: [],
  status: 'active',
  projectName: null,
  isSessionDeleted: false,
  createdAt: NOW,
  updatedAt: NOW,
});

beforeEach(async () => {
  vi.clearAllMocks();
  await seedDb();
  h.pruneChatImages.mockImplementation(async () => {
    const rows = await storySqlite().select<{ id: string }>('SELECT id FROM workspaces');
    h.workspacesAtPrune = rows.map((row) => row.id);
  });
});

describe('mergeWorkspaces slice action', () => {
  it('merges in the database and reassigns state to the target', async () => {
    const store = harness({});

    await mergeWorkspaces(
      store.set,
      store.get,
    )({ sourceWorkspaceIds: [SOURCE], targetWorkspaceId: TARGET });

    expect(await rowsOf({ sql: 'SELECT id FROM workspaces' })).toEqual([{ id: TARGET }]);
    expect(h.workspacesAtPrune).toEqual([TARGET]);
    expect(store.state.workspaces.map((entry) => entry.id)).toEqual([TARGET]);
    expect(store.state.projects.map((entry) => entry.workspaceId)).toEqual([TARGET, TARGET]);
    expect(store.state.archivedSessions[SOURCE]).toBeUndefined();
    expect(store.state.workspaceIntegrations[SOURCE]).toBeUndefined();
    expect(store.state.workspaceOverrides[SOURCE]).toBeUndefined();
  });

  it('keeps the learnings and board tasks of the source on the target, in the db and the caches', async () => {
    const store = harness({});

    await mergeWorkspaces(
      store.set,
      store.get,
    )({ sourceWorkspaceIds: [SOURCE], targetWorkspaceId: TARGET });

    expect(
      await rowsOf({ sql: 'SELECT id, workspace_id FROM session_context_items ORDER BY id' }),
    ).toEqual([
      { id: 'learn-live', workspace_id: TARGET },
      { id: 'learn-orphan', workspace_id: TARGET },
    ]);
    expect(store.state.workspaceLearnings[SOURCE]).toBeUndefined();
    expect(store.state.workspaceLearnings[TARGET]?.map((item) => item.id).sort()).toEqual([
      'learn-live',
      'learn-orphan',
    ]);
    expect(store.state.sessionContextItems[SESSION]?.map((item) => item.workspaceId)).toEqual([
      TARGET,
    ]);
    expect(store.state.workspaceExternalTasks[SOURCE]).toBeUndefined();
    expect(store.state.workspaceExternalTasks[TARGET]?.map((task) => task.identifier)).toEqual([
      'NW-7',
    ]);
  });

  it('reloads the current workspace when it is the merge target', async () => {
    const store = harness({ currentWorkspaceId: TARGET });

    await mergeWorkspaces(
      store.set,
      store.get,
    )({ sourceWorkspaceIds: [SOURCE], targetWorkspaceId: TARGET });

    expect(store.state.setCurrentWorkspace).toHaveBeenCalledWith(TARGET);
  });

  it('refuses an unknown target and touches nothing', async () => {
    const store = harness({});

    await expect(
      mergeWorkspaces(
        store.set,
        store.get,
      )({ sourceWorkspaceIds: [SOURCE], targetWorkspaceId: 'ws-ghost' as WorkspaceId }),
    ).rejects.toThrow(/workspace not found/);

    expect(await rowsOf({ sql: 'SELECT id FROM workspaces ORDER BY id' })).toHaveLength(2);
    expect(store.state.workspaces).toHaveLength(2);
  });

  it('does nothing when only the target itself is selected', async () => {
    const store = harness({});

    await mergeWorkspaces(
      store.set,
      store.get,
    )({ sourceWorkspaceIds: [TARGET], targetWorkspaceId: TARGET });

    expect(await rowsOf({ sql: 'SELECT id FROM workspaces ORDER BY id' })).toHaveLength(2);
    expect(store.state.workspaces).toHaveLength(2);
  });
});
