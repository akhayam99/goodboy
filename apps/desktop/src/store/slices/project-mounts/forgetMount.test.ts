import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  deleteSessionMount,
  listSessionMounts,
  listMountOperations,
  getMountOperation,
  upsertMountOperation,
  updateSessionActiveMount,
  updateSessionActiveProject,
} = vi.hoisted(() => ({
  deleteSessionMount: vi.fn(async (_args: { mountId: string }) => true),
  listSessionMounts: vi.fn(async () => [] as ReadonlyArray<Record<string, unknown>>),
  listMountOperations: vi.fn(async () => [] as ReadonlyArray<Record<string, unknown>>),
  getMountOperation: vi.fn(async () => null as Record<string, unknown> | null),
  upsertMountOperation: vi.fn(async () => undefined),
  updateSessionActiveMount: vi.fn(async () => undefined),
  updateSessionActiveProject: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({
  deleteSessionMount,
  listSessionMounts,
  listMountOperations,
  getMountOperation,
  upsertMountOperation,
  updateSessionActiveMount,
  updateSessionActiveProject,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { forgetMount } from './forgetMount';

const SESSION_ID = 'sess-1' as never;
const MOUNT_ID = 'mount-api' as never;

const makeView = (overrides: Record<string, unknown>) => ({
  id: 'mount-api',
  sessionId: 'sess-1',
  projectId: 'project-api',
  mountName: 'api',
  repoRoot: '/repos/api',
  branch: 'ak/feat',
  baseBranch: null,
  worktreePath: null,
  lastWorktreePath: '/container/api',
  parallelIndex: 0,
  isAttached: false,
  diskState: 'removed',
  revision: 2,
  ...overrides,
});

const PENDING_PROPOSAL = {
  id: 'op-cleanup',
  sessionId: 'sess-1',
  mountId: 'mount-api',
  requestId: 'cleanup:merge_cleanup:mount-api:ak/feat',
  kind: 'remove',
  status: 'pending',
  expectedRevision: 0,
  input: {
    worktreePath: '/container/api',
    repoRoot: '/repos/api',
    branch: 'ak/feat',
  },
  result: null,
  errorCode: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const makeStore = () => ({
  sessionMounts: {
    'sess-1': [makeView({}), makeView({ id: 'mount-web', projectId: 'project-web' })] as Array<
      Record<string, unknown>
    >,
  } as Record<string, Array<Record<string, unknown>>>,
  mountCleanupProposals: {} as Record<string, ReadonlyArray<{ readonly requestId: string }>>,
  mountBranchObservations: {
    'sess-1': [{ mountId: 'mount-api', state: 'mismatch' }, { mountId: 'mount-web' }],
  } as Record<string, ReadonlyArray<{ readonly mountId: string; readonly state?: string }>>,
  sessionProjectMounts: {
    'sess-1': [
      {
        mountId: 'mount-web',
        projectId: 'project-web',
        mountName: 'web',
        worktreePath: '/container/web',
        repoRoot: '/repos/web',
        branch: 'ak/web',
      },
    ],
  } as Record<string, ReadonlyArray<Record<string, unknown>>>,
  sessionWorktreeRecords: undefined as Record<string, ReadonlyArray<unknown>> | undefined,
  sessionActiveProject: { 'sess-1': 'project-web' } as Record<string, string>,
  sessionActiveMount: { 'sess-1': 'mount-web' } as Record<string, string | null>,
  sessionBranches: { 'sess-1': 'ak/web' } as Record<string, string>,
  sessions: [
    {
      id: 'sess-1',
      workspaceId: 'ws-1',
      activeProjectId: 'project-web',
      activeMountId: 'mount-web' as string | undefined,
      state: { kind: 'idle' } as { readonly kind: string },
    },
  ],
  terminalTabs: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
  projects: [
    { id: 'project-api', workspaceId: 'ws-1', rootPath: '/repos/api', kind: 'repo', name: 'api' },
  ],
  reconcileOrphanWorktrees: vi.fn(async () => undefined),
});

type Store = ReturnType<typeof makeStore>;

const run = async (store: Store) => {
  const set = vi.fn((updater: unknown) => {
    const patch =
      typeof updater === 'function' ? (updater as (s: Store) => object)(store) : updater;
    Object.assign(store, patch);
  });
  return forgetMount(
    set as never,
    (() => store) as never,
  )({
    sessionId: SESSION_ID,
    mountId: MOUNT_ID,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  deleteSessionMount.mockImplementation(async () => true);
  listSessionMounts.mockImplementation(async () => [makeView({})]);
  listMountOperations.mockImplementation(async () => []);
  getMountOperation.mockImplementation(async () => null);
  updateSessionActiveMount.mockImplementation(async () => undefined);
  updateSessionActiveProject.mockImplementation(async () => undefined);
});

describe('forgetMount', () => {
  it('deletes the mount row and drops it from the session rows', async () => {
    const store = makeStore();

    const result = await run(store);

    expect(deleteSessionMount).toHaveBeenCalledWith({
      db: {},
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
    });
    expect(store.sessionMounts['sess-1']?.map((view) => view['id'])).toEqual(['mount-web']);
    expect(result.keptPath).toBeNull();
  });

  it('names the directory it leaves behind when the files are still there', async () => {
    const store = makeStore();
    store.sessionMounts['sess-1'] = [makeView({ diskState: 'present' })];

    const result = await run(store);

    expect(result.keptPath).toBe('/container/api');
  });

  it('refuses a mount the rendered rows still show as attached', async () => {
    const store = makeStore();
    store.sessionMounts['sess-1'] = [
      makeView({ isAttached: true, worktreePath: '/container/api', diskState: 'present' }),
    ];

    await expect(run(store)).rejects.toThrow('unmount the branch');
    expect(deleteSessionMount).not.toHaveBeenCalled();
  });

  it('removes a mount the rendered rows show as detached even when the row still says attached', async () => {
    const store = makeStore();
    store.sessionMounts['sess-1'] = [makeView({ diskState: 'unchecked' })];
    listSessionMounts.mockImplementation(async () => [
      makeView({ isAttached: true, worktreePath: '/container/api', diskState: 'present' }),
    ]);

    const result = await run(store);

    expect(deleteSessionMount).toHaveBeenCalledWith({
      db: {},
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
    });
    expect(result.keptPath).toBe('/container/api');
  });

  it('falls back to the stored rows when the session has none rendered', async () => {
    const store = makeStore();
    store.sessionMounts = {};

    await run(store);

    expect(listSessionMounts).toHaveBeenCalled();
    expect(deleteSessionMount).toHaveBeenCalledWith({
      db: {},
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
    });
  });

  it('settles the pending cleanup proposal of the mount it deletes', async () => {
    const store = makeStore();
    store.mountCleanupProposals = { 'sess-1': [{ requestId: PENDING_PROPOSAL.requestId }] };
    listMountOperations.mockImplementation(async () => [PENDING_PROPOSAL]);
    getMountOperation.mockImplementation(async () => PENDING_PROPOSAL);

    await run(store);

    expect(upsertMountOperation).toHaveBeenCalledWith({
      db: {},
      operation: expect.objectContaining({
        requestId: PENDING_PROPOSAL.requestId,
        status: 'succeeded',
        result: { outcome: 'removed', detail: 'the mount left the session' },
      }),
    });
    expect(store.mountCleanupProposals['sess-1']).toEqual([]);
  });

  it('hands a directory it leaves behind to the orphan sweep', async () => {
    const store = makeStore();
    store.sessionMounts['sess-1'] = [makeView({ diskState: 'present' })];

    await run(store);

    expect(store.reconcileOrphanWorktrees).toHaveBeenCalled();
  });

  it('leaves the orphan sweep alone when the files were already gone', async () => {
    const store = makeStore();

    const result = await run(store);

    expect(result.keptPath).toBeNull();
    expect(store.reconcileOrphanWorktrees).not.toHaveBeenCalled();
  });

  it('clears the branch observation of the row it deletes', async () => {
    const store = makeStore();

    await run(store);

    expect(store.mountBranchObservations['sess-1']?.map((entry) => entry.mountId)).toEqual([
      'mount-web',
    ]);
  });

  it('refuses a mount whose worktree a terminal still holds', async () => {
    const store = makeStore();
    store.terminalTabs = {
      'sess-1': [{ id: 'tab-1', sessionId: 'sess-1', cwd: '/container/api' }],
    };

    await expect(run(store)).rejects.toThrow('a terminal is open in the worktree');
    expect(deleteSessionMount).not.toHaveBeenCalled();
  });

  it('refuses a mount while an agent still runs in the session', async () => {
    const store = makeStore();
    store.sessions[0]!.state = { kind: 'running' };

    await expect(run(store)).rejects.toThrow('an agent is still running in this session');
    expect(deleteSessionMount).not.toHaveBeenCalled();
  });

  it('hands the write destination on when the deleted mount was the stored one', async () => {
    const store = makeStore();
    store.sessionActiveMount = { 'sess-1': 'mount-api' };
    store.sessions[0]!.activeMountId = 'mount-api';

    await run(store);

    expect(updateSessionActiveMount).toHaveBeenCalledWith({
      db: {},
      sessionId: SESSION_ID,
      mountId: 'mount-web',
    });
    expect(store.sessionActiveMount['sess-1']).toBe('mount-web');
    expect(store.sessions[0]?.activeMountId).toBe('mount-web');
    expect(store.sessionBranches['sess-1']).toBe('ak/web');
  });

  it('invents no write destination for a session that had none', async () => {
    const store = makeStore();
    store.sessionActiveMount = { 'sess-1': null };
    store.sessions[0]!.activeMountId = undefined;

    await run(store);

    expect(updateSessionActiveMount).not.toHaveBeenCalled();
    expect(store.sessionActiveMount['sess-1']).toBeNull();
    expect(store.sessions[0]?.activeMountId).toBeUndefined();
  });

  it('moves the active project on when the last mount of that project leaves', async () => {
    const store = makeStore();
    store.sessionActiveProject = { 'sess-1': 'project-api' };
    store.sessions[0]!.activeProjectId = 'project-api';
    store.sessionMounts['sess-1'] = [
      makeView({}),
      makeView({ id: 'mount-web', projectId: 'project-web' }),
    ];

    await run(store);

    expect(updateSessionActiveProject).toHaveBeenCalledWith({
      db: {},
      id: SESSION_ID,
      projectId: 'project-web',
    });
    expect(store.sessionActiveProject['sess-1']).toBe('project-web');
    expect(store.sessions[0]?.activeProjectId).toBe('project-web');
  });

  it('refuses a mount the session does not have', async () => {
    const store = makeStore();
    store.sessionMounts['sess-1'] = [];
    listSessionMounts.mockImplementation(async () => []);

    await expect(run(store)).rejects.toThrow('mount not found');
  });
});
