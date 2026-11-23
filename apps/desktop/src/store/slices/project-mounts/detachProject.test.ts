// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  removeWorktreeChecked,
  worktreeWriterStatus,
  deleteSessionMount,
  listSessionMounts,
  listMountOperations,
  getMountOperation,
  upsertMountOperation,
  updateSessionWriteDestination,
  updateSessionActiveProject,
  listMountPullRequestLinks,
  updateSessionMountLifecycle,
} = vi.hoisted(() => ({
  removeWorktreeChecked: vi.fn(
    async ({
      worktreePath,
    }: {
      worktreePath: string;
    }): Promise<{ kind: string; path: string; reasons?: ReadonlyArray<string> }> => ({
      kind: 'removed',
      path: worktreePath,
    }),
  ),
  worktreeWriterStatus: vi.fn(async ({ path }: { path: string }) => ({
    path,
    holder: null,
    token: null,
    runId: null,
    isGranted: false,
    hasExited: false,
    waiting: [],
  })),
  deleteSessionMount: vi.fn(async (_args: { mountId: string }) => true),
  listSessionMounts: vi.fn(async (): Promise<ReadonlyArray<Record<string, unknown>>> => []),
  listMountOperations: vi.fn(async (): Promise<ReadonlyArray<Record<string, unknown>>> => []),
  getMountOperation: vi.fn(async (): Promise<Record<string, unknown> | null> => null),
  upsertMountOperation: vi.fn(async () => undefined),
  updateSessionWriteDestination: vi.fn(async () => true),
  updateSessionActiveProject: vi.fn(async () => undefined),
  listMountPullRequestLinks: vi.fn(async (): Promise<ReadonlyArray<Record<string, unknown>>> => []),
  updateSessionMountLifecycle: vi.fn(async () => true),
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    deleteSessionMount,
    listSessionMounts,
    listMountOperations,
    getMountOperation,
    upsertMountOperation,
    updateSessionWriteDestination,
    updateSessionActiveProject,
    listMountPullRequestLinks,
    updateSessionMountLifecycle,
  }),
);
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/worktree/worktree', () => ({
  removeWorktreeChecked,
  worktreeWriterStatus,
  removeSessionDirectory: vi.fn(async () => undefined),
}));

import type { ProjectId, SessionId } from '@goodboy/types';
import { detachProject } from './detachProject';
import type { DetachDisposition } from './detachProject';
import type { GetFn, SetFn } from './types';
import { withRepositoryAndMountLock } from './mountLocks';

type IdParams = { readonly value: string };

const isSessionId = (value: string): value is SessionId => value.length > 0;
const isProjectId = (value: string): value is ProjectId => value.length > 0;

const sessionIdOf = ({ value }: IdParams): SessionId => {
  if (!isSessionId(value)) {
    throw new Error('session id is empty');
  }
  return value;
};

const projectIdOf = ({ value }: IdParams): ProjectId => {
  if (!isProjectId(value)) {
    throw new Error('project id is empty');
  }
  return value;
};

const SESSION_ID = sessionIdOf({ value: 'sess-1' });
const PROJECT_ID = projectIdOf({ value: 'project-api' });

type View = {
  readonly id: string;
  readonly sessionId: string;
  readonly projectId: string;
  readonly mountName: string;
  readonly branch: string;
  readonly baseBranch: string | null;
  readonly worktreePath: string | null;
  readonly lastWorktreePath: string | null;
  readonly parallelIndex: number;
  readonly isAttached: boolean;
  readonly diskState: string;
  readonly revision: number;
};

const makeView = (overrides: Partial<View>): View => ({
  id: 'mount-api',
  sessionId: 'sess-1',
  projectId: 'project-api',
  mountName: 'api',
  branch: 'ak/feat',
  baseBranch: null,
  worktreePath: null,
  lastWorktreePath: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
  ...overrides,
});

const VIEW_API = makeView({ worktreePath: '/container/api', revision: 4 });
const VIEW_API_2 = makeView({
  id: 'mount-api-2',
  worktreePath: '/container/api-2',
  branch: 'ak/feat-2',
  parallelIndex: 1,
});
const VIEW_WEB = makeView({
  id: 'mount-web',
  projectId: 'project-web',
  mountName: 'web',
  worktreePath: '/container/web',
});

const VIEWS = [VIEW_API, VIEW_API_2, VIEW_WEB];

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

type StoreSession = {
  readonly id: string;
  readonly workspaceId: string;
  readonly activeProjectId: string;
  activeMountId?: string;
  state: { readonly kind: string };
};

type Store = {
  sessionMounts: Record<'sess-1', ReadonlyArray<View & { readonly repoRoot: string }>>;
  sessionProjectMounts: Record<
    'sess-1',
    ReadonlyArray<{
      readonly mountId: string;
      readonly revision?: number;
      readonly projectId: string;
      readonly mountName: string;
      readonly worktreePath: string;
      readonly repoRoot: string;
      readonly branch: string;
    }>
  >;
  sessionWorktrees: Record<'sess-1', ReadonlyArray<string>>;
  sessionWorktreeRecords: Record<string, ReadonlyArray<unknown>> | undefined;
  mountCleanupProposals: Record<string, ReadonlyArray<{ readonly requestId: string }>>;
  mountBranchObservations: Record<
    string,
    ReadonlyArray<{ readonly mountId: string; readonly state?: string }>
  >;
  sessionActiveProject: Record<string, string>;
  sessionActiveMount: Record<string, string | null>;
  sessionBranches: Record<string, string>;
  sessions: Array<StoreSession>;
  terminalTabs: Record<
    string,
    ReadonlyArray<{ readonly id: string; readonly sessionId: string; readonly cwd: string }>
  >;
  sessionPhaseRuns: Record<string, ReadonlyArray<{ readonly id: string; readonly status: string }>>;
  agentTurnDestination: Record<string, { readonly kind: string; readonly mountId?: string }>;
  sessionResolveAttempts: Record<
    string,
    ReadonlyArray<{ readonly phase: string; readonly mountTarget: { mountId: string } | null }>
  >;
  projects: ReadonlyArray<{
    readonly id: string;
    readonly workspaceId: string;
    readonly rootPath: string;
    readonly kind: string;
    readonly name: string;
  }>;
  recordSessionEvent: ReturnType<typeof vi.fn>;
  reconcileOrphanWorktrees: ReturnType<typeof vi.fn>;
};

const makeStore = (): Store => ({
  sessionMounts: {
    'sess-1': [
      { ...VIEW_API, repoRoot: '/repos/api' },
      { ...VIEW_API_2, repoRoot: '/repos/api' },
      { ...VIEW_WEB, repoRoot: '/repos/web' },
    ],
  },
  sessionProjectMounts: {
    'sess-1': [
      {
        mountId: 'mount-api',
        revision: 4,
        projectId: 'project-api',
        mountName: 'api',
        worktreePath: '/container/api',
        repoRoot: '/repos/api',
        branch: 'ak/feat',
      },
      {
        mountId: 'mount-api-2',
        revision: 1,
        projectId: 'project-api',
        mountName: 'api',
        worktreePath: '/container/api-2',
        repoRoot: '/repos/api',
        branch: 'ak/feat-2',
      },
      {
        mountId: 'mount-web',
        projectId: 'project-web',
        mountName: 'web',
        worktreePath: '/container/web',
        repoRoot: '/repos/web',
        branch: 'ak/feat',
      },
    ],
  },
  sessionWorktrees: {
    'sess-1': ['/container', '/container/api', '/container/api-2', '/container/web'],
  },
  sessionWorktreeRecords: undefined,
  mountCleanupProposals: {},
  mountBranchObservations: {
    'sess-1': [
      { mountId: 'mount-api', state: 'mismatch' },
      { mountId: 'mount-api-2', state: 'detached' },
      { mountId: 'mount-web', state: 'mismatch' },
    ],
  },
  sessionActiveProject: { 'sess-1': 'project-api' },
  sessionActiveMount: { 'sess-1': 'mount-api' },
  sessionBranches: { 'sess-1': 'ak/feat' },
  sessions: [
    {
      id: 'sess-1',
      workspaceId: 'ws-1',
      activeProjectId: 'project-api',
      activeMountId: 'mount-api',
      state: { kind: 'idle' },
    },
  ],
  terminalTabs: {},
  sessionPhaseRuns: {},
  agentTurnDestination: {},
  sessionResolveAttempts: {},
  projects: [
    { id: 'project-api', workspaceId: 'ws-1', rootPath: '/repos/api', kind: 'repo', name: 'api' },
    { id: 'project-web', workspaceId: 'ws-1', rootPath: '/repos/web', kind: 'repo', name: 'web' },
  ],
  recordSessionEvent: vi.fn(async () => undefined),
  reconcileOrphanWorktrees: vi.fn(async () => undefined),
});

const flush = async (): Promise<void> => {
  for (let index = 0; index < 5; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

type Updater = (current: Store) => object;

const isUpdater = (value: unknown): value is Updater => typeof value === 'function';
const isSetFn = (value: unknown): value is SetFn => typeof value === 'function';
const isGetFn = (value: unknown): value is GetFn => typeof value === 'function';

const runDetach = async (store: Store, disposition?: DetachDisposition) => {
  const set = vi.fn((updater: unknown) => {
    const patch = isUpdater(updater) ? updater(store) : updater;
    Object.assign(store, patch);
  });
  const get = () => store;
  if (!isSetFn(set) || !isGetFn(get)) {
    throw new Error('store doubles are not callable');
  }
  return detachProject(
    set,
    get,
  )({
    sessionId: SESSION_ID,
    projectId: PROJECT_ID,
    ...(disposition === undefined ? {} : { disposition }),
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  deleteSessionMount.mockImplementation(async () => true);
  listSessionMounts.mockImplementation(async () => VIEWS);
  listMountOperations.mockImplementation(async () => []);
  getMountOperation.mockImplementation(async () => null);
  listMountPullRequestLinks.mockImplementation(async () => []);
  updateSessionMountLifecycle.mockImplementation(async () => true);
  removeWorktreeChecked.mockImplementation(async ({ worktreePath }: { worktreePath: string }) => ({
    kind: 'removed',
    path: worktreePath,
  }));
});

describe('detachProject', () => {
  it('names the mount in every outcome and in the events it records', async () => {
    const store = makeStore();

    const outcomes = await runDetach(store);

    expect(outcomes.map((outcome) => outcome.mountId)).toEqual(['mount-api', 'mount-api-2']);
    expect(store.recordSessionEvent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'project_detached',
      payload: expect.objectContaining({ mountId: 'mount-api-2' }),
    });
  });

  it('removes every worktree of the project and deletes its mount rows', async () => {
    const store = makeStore();

    await runDetach(store);

    expect(removeWorktreeChecked).toHaveBeenCalledWith({
      repoPath: '/repos/api',
      worktreePath: '/container/api',
      mode: 'safe',
    });
    expect(removeWorktreeChecked).toHaveBeenCalledWith({
      repoPath: '/repos/api',
      worktreePath: '/container/api-2',
      mode: 'safe',
    });
    expect(deleteSessionMount).toHaveBeenCalledWith({
      db: {},
      sessionId: SESSION_ID,
      mountId: 'mount-api',
    });
    expect(deleteSessionMount).toHaveBeenCalledWith({
      db: {},
      sessionId: SESSION_ID,
      mountId: 'mount-api-2',
    });
    expect(deleteSessionMount).not.toHaveBeenCalledWith(
      expect.objectContaining({ mountId: 'mount-web' }),
    );
    expect(store.recordSessionEvent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'project_detached',
      payload: expect.objectContaining({
        projectId: 'project-api',
        projectName: 'api',
        branch: 'ak/feat',
        kept: false,
      }),
    });
    expect(store.sessionProjectMounts['sess-1'].map((m) => m.projectId)).toEqual(['project-web']);
    expect(store.sessionWorktrees['sess-1']).toEqual(['/container', '/container/web']);
  });

  it('drops the project from the mount rows the overview renders', async () => {
    const store = makeStore();

    await runDetach(store);

    expect(store.sessionMounts['sess-1'].map((view) => view.id)).toEqual(['mount-web']);
  });

  it('keeps a dirty worktree on disk and still drops the project from the session', async () => {
    const store = makeStore();
    removeWorktreeChecked.mockResolvedValue({
      kind: 'kept',
      path: '/container/api',
      reasons: ['unstaged-changes'],
    });

    await runDetach(store);

    expect(deleteSessionMount).toHaveBeenCalledWith({
      db: {},
      sessionId: SESSION_ID,
      mountId: 'mount-api',
    });
    expect(store.recordSessionEvent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'project_detached',
      payload: expect.objectContaining({ kept: true, reason: 'unstaged-changes' }),
    });
    expect(store.sessionMounts['sess-1'].map((view) => view.id)).toEqual(['mount-web']);
    expect(store.sessionProjectMounts['sess-1'].map((m) => m.projectId)).toEqual(['project-web']);
  });

  it('detaches a project whose mounts were already released', async () => {
    const store = makeStore();
    listSessionMounts.mockImplementation(async () => [
      makeView({
        id: 'mount-api',
        projectId: 'project-api',
        mountName: 'api',
        worktreePath: null,
        lastWorktreePath: '/container/api',
        branch: 'ak/feat',
        isAttached: false,
        diskState: 'removed',
      }),
      VIEW_WEB,
    ]);
    store.sessionProjectMounts['sess-1'] = store.sessionProjectMounts['sess-1'].filter(
      (m) => m.projectId === 'project-web',
    );
    store.sessionMounts['sess-1'] = store.sessionMounts['sess-1'].filter(
      (view) => view.id !== 'mount-api-2',
    );

    const outcomes = await runDetach(store);

    expect(removeWorktreeChecked).not.toHaveBeenCalled();
    expect(outcomes.map((outcome) => outcome.kind)).toEqual(['missing']);
    expect(deleteSessionMount).toHaveBeenCalledWith({
      db: {},
      sessionId: SESSION_ID,
      mountId: 'mount-api',
    });
    expect(store.sessionMounts['sess-1'].map((view) => view.id)).toEqual(['mount-web']);
  });

  it('fails a released mount whose kept record lost its revision to another window', async () => {
    const store = makeStore();
    listSessionMounts.mockImplementation(async () => [
      makeView({
        id: 'mount-api',
        projectId: 'project-api',
        mountName: 'api',
        worktreePath: null,
        lastWorktreePath: '/container/api',
        branch: 'ak/feat',
        isAttached: false,
        diskState: 'removed',
      }),
      VIEW_WEB,
    ]);
    listMountPullRequestLinks.mockImplementation(async () => [{ id: 'link-1' }]);
    updateSessionMountLifecycle.mockImplementation(async () => false);

    const outcomes = await runDetach(store);

    expect(outcomes).toEqual([expect.objectContaining({ mountId: 'mount-api', kind: 'failed' })]);
    expect(store.recordSessionEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'project_detached' }),
    );
  });

  it('removes a released directory that is still on disk', async () => {
    const store = makeStore();
    listSessionMounts.mockImplementation(async () => [
      makeView({
        id: 'mount-api',
        projectId: 'project-api',
        mountName: 'api',
        worktreePath: null,
        lastWorktreePath: '/container/api',
        branch: 'ak/feat',
        isAttached: false,
        diskState: 'present',
      }),
    ]);
    store.sessionProjectMounts['sess-1'] = [];

    await runDetach(store);

    expect(removeWorktreeChecked).toHaveBeenCalledWith({
      repoPath: '/repos/api',
      worktreePath: '/container/api',
      mode: 'safe',
    });
  });

  it('keeps a live sibling path when a released row still names it as its last path', async () => {
    const store = makeStore();
    listSessionMounts.mockImplementation(async () => [
      makeView({
        id: 'mount-api',
        worktreePath: null,
        lastWorktreePath: '/container/web',
        isAttached: false,
        diskState: 'removed',
      }),
      VIEW_WEB,
    ]);
    store.sessionProjectMounts['sess-1'] = store.sessionProjectMounts['sess-1'].filter(
      (m) => m.projectId === 'project-web',
    );

    await runDetach(store);

    expect(deleteSessionMount).toHaveBeenCalledWith({
      db: {},
      sessionId: SESSION_ID,
      mountId: 'mount-api',
    });
    expect(store.sessionWorktrees['sess-1']).toContain('/container/web');
  });

  it('reports a removal failure and keeps the mount attached', async () => {
    const store = makeStore();
    removeWorktreeChecked.mockRejectedValue(new Error('not a git repository'));

    const outcomes = await runDetach(store);

    expect(outcomes.map((outcome) => outcome.kind)).toEqual(['failed', 'failed']);
    expect(deleteSessionMount).not.toHaveBeenCalled();
    expect(store.recordSessionEvent).not.toHaveBeenCalled();
    expect(store.sessionProjectMounts['sess-1'].map((m) => m.projectId)).toEqual([
      'project-api',
      'project-api',
      'project-web',
    ]);
    expect(store.sessionActiveProject['sess-1']).toBe('project-api');
  });

  it('leaves the project in place when one of its mounts could not be removed', async () => {
    const store = makeStore();
    listSessionMounts.mockImplementation(async () => [
      makeView({
        id: 'mount-api',
        worktreePath: null,
        lastWorktreePath: '/container/api',
        isAttached: false,
        diskState: 'present',
      }),
      VIEW_API_2,
      VIEW_WEB,
    ]);
    store.sessionProjectMounts['sess-1'] = store.sessionProjectMounts['sess-1'].filter(
      (m) => m.mountId !== 'mount-api',
    );
    store.sessionWorktreeRecords = {
      'sess-1': [{ projectId: 'project-api' }, { projectId: 'project-web' }],
    };
    removeWorktreeChecked.mockImplementation(async ({ worktreePath }: { worktreePath: string }) => {
      if (worktreePath === '/container/api') {
        throw new Error('not a git repository');
      }
      return { kind: 'removed', path: worktreePath };
    });

    const outcomes = await runDetach(store);

    expect(outcomes.map((outcome) => outcome.kind)).toEqual(['failed', 'removed']);
    expect(updateSessionActiveProject).not.toHaveBeenCalled();
    expect(store.sessionActiveProject['sess-1']).toBe('project-api');
    expect(store.sessionWorktreeRecords?.['sess-1']).toEqual([
      { projectId: 'project-api' },
      { projectId: 'project-web' },
    ]);
    expect(store.sessionMounts['sess-1'].map((view) => view.id)).toContain('mount-api');
  });

  it('forces removal only when the user confirmed the risky path', async () => {
    const store = makeStore();

    await runDetach(store, 'delete-files');

    expect(removeWorktreeChecked).toHaveBeenCalledWith({
      repoPath: '/repos/api',
      worktreePath: '/container/api',
      mode: 'confirmed',
    });
  });

  it('keeps every directory when the user asked to keep files', async () => {
    const store = makeStore();

    const outcomes = await runDetach(store, 'keep-files');

    expect(removeWorktreeChecked).not.toHaveBeenCalled();
    expect(outcomes.map((outcome) => outcome.kind)).toEqual(['kept', 'kept']);
    expect(store.sessionProjectMounts['sess-1'].map((m) => m.projectId)).toEqual(['project-web']);
    expect(store.sessionMounts['sess-1'].map((view) => view.id)).toEqual(['mount-web']);
    expect(store.reconcileOrphanWorktrees).toHaveBeenCalled();
  });

  it('refuses to drop a mount while an agent still runs in the session', async () => {
    const store = makeStore();
    store.sessions[0]!.state = { kind: 'running' };

    const outcomes = await runDetach(store, 'keep-files');

    expect(outcomes.map((outcome) => outcome.kind)).toEqual(['failed', 'failed']);
    expect(outcomes[0]?.reason).toBe('an agent is still writing to this mount');
    expect(deleteSessionMount).not.toHaveBeenCalled();
    expect(store.sessionMounts['sess-1'].map((view) => view.id)).toEqual([
      'mount-api',
      'mount-api-2',
      'mount-web',
    ]);
  });

  it('drops the sibling a running turn is not writing to', async () => {
    const store = makeStore();
    store.sessions[0]!.state = { kind: 'running' };
    store.sessionPhaseRuns = { 'sess-1': [{ id: 'agent-1', status: 'running' }] };
    store.agentTurnDestination = { 'agent-1': { kind: 'mount', mountId: 'mount-api' } };

    const outcomes = await runDetach(store, 'keep-files');

    expect(outcomes.map((outcome) => outcome.kind)).toEqual(['failed', 'kept']);
    expect(outcomes[0]?.reason).toBe('an agent is still writing to this mount');
    expect(deleteSessionMount).toHaveBeenCalledWith({
      db: {},
      sessionId: SESSION_ID,
      mountId: 'mount-api-2',
    });
  });

  it('refuses to drop a mount whose worktree a terminal still holds', async () => {
    const store = makeStore();
    store.terminalTabs = {
      'sess-1': [{ id: 'tab-1', sessionId: 'sess-1', cwd: '/container/api' }],
    };

    const outcomes = await runDetach(store);

    expect(removeWorktreeChecked).not.toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: '/container/api' }),
    );
    expect(outcomes.find((outcome) => outcome.worktreePath === '/container/api')).toEqual({
      mountId: 'mount-api',
      worktreePath: '/container/api',
      kind: 'failed',
      reason: 'a terminal is open in the worktree',
    });
    expect(deleteSessionMount).not.toHaveBeenCalledWith(
      expect.objectContaining({ mountId: 'mount-api' }),
    );
    expect(store.sessionMounts['sess-1'].map((view) => view.id)).toEqual([
      'mount-api',
      'mount-web',
    ]);
  });

  it('settles the pending cleanup proposal of the mount it deletes', async () => {
    const store = makeStore();
    store.mountCleanupProposals = {
      'sess-1': [{ requestId: PENDING_PROPOSAL.requestId }],
    };
    listMountOperations.mockImplementation(async () => [PENDING_PROPOSAL]);
    getMountOperation.mockImplementation(async () => PENDING_PROPOSAL);

    await runDetach(store);

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

  it('settles the proposal as kept when the directory stays on disk', async () => {
    const store = makeStore();
    listMountOperations.mockImplementation(async () => [PENDING_PROPOSAL]);
    getMountOperation.mockImplementation(async () => PENDING_PROPOSAL);

    await runDetach(store, 'keep-files');

    expect(upsertMountOperation).toHaveBeenCalledWith({
      db: {},
      operation: expect.objectContaining({
        status: 'succeeded',
        result: { outcome: 'kept', detail: 'the mount left the session' },
      }),
    });
  });

  it('keeps detaching the next mount when one row cannot be deleted', async () => {
    const store = makeStore();
    deleteSessionMount.mockImplementation(async ({ mountId }: { mountId: string }) => {
      if (mountId === 'mount-api') {
        throw new Error('database is locked');
      }
      return true;
    });

    const outcomes = await runDetach(store);

    expect(outcomes).toEqual([
      expect.objectContaining({
        mountId: 'mount-api',
        kind: 'failed',
        reason: expect.stringContaining('database is locked'),
      }),
      expect.objectContaining({ mountId: 'mount-api-2', kind: 'removed' }),
    ]);
    expect(store.sessionProjectMounts['sess-1'].map((m) => m.worktreePath)).toEqual([
      '/container/api',
      '/container/web',
    ]);
    expect(store.sessionActiveProject['sess-1']).toBe('project-api');
    expect(upsertMountOperation).toHaveBeenCalledWith({
      db: {},
      operation: expect.objectContaining({
        kind: 'remove',
        status: 'uncertain',
        mountId: null,
        input: expect.objectContaining({ mountId: 'mount-api', finish: 'drop-row' }),
      }),
    });
  });

  it('hands the active project and the write destination to the next remaining mount', async () => {
    const store = makeStore();

    await runDetach(store);

    expect(updateSessionWriteDestination).toHaveBeenCalledWith({
      db: {},
      sessionId: SESSION_ID,
      mountId: 'mount-web',
    });
    expect(store.sessionActiveProject['sess-1']).toBe('project-web');
    expect(store.sessionActiveMount['sess-1']).toBe('mount-web');
    expect(store.sessions[0]?.activeMountId).toBe('mount-web');
    expect(store.sessionBranches['sess-1']).toBe('ak/feat');
  });

  it('keeps a selection no removal touched and heals the session row', async () => {
    const store = makeStore();
    store.sessionActiveMount = { 'sess-1': 'mount-web' };

    await runDetach(store);

    expect(store.sessions[0]?.activeMountId).toBe('mount-web');
    expect(store.sessionActiveProject['sess-1']).toBe('project-web');
    expect(updateSessionWriteDestination).not.toHaveBeenCalled();
  });

  it('clears the departed project without naming a new destination', async () => {
    const store = makeStore();
    store.sessionActiveMount = { 'sess-1': null };
    store.sessions[0]!.activeMountId = undefined;

    await runDetach(store);

    expect(updateSessionWriteDestination).toHaveBeenCalledWith({
      db: {},
      sessionId: SESSION_ID,
      mountId: null,
    });
    expect(store.sessionActiveMount['sess-1']).toBeNull();
    expect(store.sessions[0]?.activeMountId).toBeUndefined();
    expect(store.sessionActiveProject['sess-1']).toBeUndefined();
  });

  it('leaves no write destination when the last project is detached', async () => {
    const store = makeStore();
    listSessionMounts.mockImplementation(async () => [VIEW_API, VIEW_API_2]);
    store.sessionMounts['sess-1'] = [
      { ...VIEW_API, repoRoot: '/repos/api' },
      { ...VIEW_API_2, repoRoot: '/repos/api' },
    ];
    store.sessionProjectMounts['sess-1'] = store.sessionProjectMounts['sess-1'].filter(
      (mount) => mount.projectId === 'project-api',
    );
    store.sessionWorktrees['sess-1'] = ['/container', '/container/api', '/container/api-2'];

    await runDetach(store);

    expect(store.sessionProjectMounts['sess-1']).toEqual([]);
    expect(store.sessionActiveMount['sess-1']).toBeNull();
    expect(store.sessionBranches['sess-1']).toBeUndefined();
    expect(store.sessions[0]).not.toHaveProperty('activeMountId');
    expect(updateSessionWriteDestination).toHaveBeenCalledWith({
      db: {},
      sessionId: SESSION_ID,
      mountId: null,
    });
  });

  it('clears the branch observations of the rows it deletes', async () => {
    const store = makeStore();

    await runDetach(store);

    expect(store.mountBranchObservations['sess-1']?.map((entry) => entry.mountId)).toEqual([
      'mount-web',
    ]);
  });

  it('waits for an in-flight operation on the same mount before touching its row', async () => {
    const store = makeStore();
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const holder = withRepositoryAndMountLock({
      repoRoot: '/repos/api',
      mountKey: 'sess-1:mount-api',
      run: async () => {
        await held;
      },
    });

    const detaching = runDetach(store);
    await flush();

    expect(removeWorktreeChecked).not.toHaveBeenCalled();
    expect(deleteSessionMount).not.toHaveBeenCalled();

    release();
    await holder;
    await detaching;

    expect(deleteSessionMount).toHaveBeenCalledWith({
      db: {},
      sessionId: SESSION_ID,
      mountId: 'mount-api',
    });
  });

  it('refuses a project that is not mounted', async () => {
    const store = makeStore();
    listSessionMounts.mockImplementation(async () => [VIEW_WEB]);
    store.sessionProjectMounts['sess-1'] = store.sessionProjectMounts['sess-1'].filter(
      (m) => m.projectId !== 'project-api',
    );

    await expect(runDetach(store)).rejects.toThrow('not mounted');
  });
});
