// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BootstrapPhase,
  MountId,
  ProjectId,
  RemoteProbe,
  SessionProjectMount,
} from '@goodboy/types';
import { aProject, aSession, EMPTY_OVERRIDES, TEST_NOW } from '@goodboy/types/testing';
import { useAppStore, type AppStore } from '../../store';
import type { GetFn, SetFn } from '../../slice-types';

const h = vi.hoisted(() => ({
  setSetting: vi.fn(async () => undefined),
  prepare: vi.fn(),
  apply: vi.fn(),
  clearRoot: vi.fn(),
  alignMain: vi.fn(),
  recover: vi.fn(),
  rollback: vi.fn(),
  discard: vi.fn(),
  liveSessionIds: [] as string[],
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({ setSetting: h.setSetting }),
);
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../shared/lib/repo', () => ({
  bootstrapPrepare: h.prepare,
  bootstrapApply: h.apply,
  bootstrapClearRoot: h.clearRoot,
  bootstrapAlignMain: h.alignMain,
  bootstrapRecover: h.recover,
  bootstrapRollback: h.rollback,
}));
vi.mock('../sessions/discardUncreatedSession', () => ({
  discardUncreatedSession: h.discard,
}));
vi.mock('../live-work/selectLiveWork', () => ({
  selectLiveWork: () => ({ liveSessionIds: h.liveSessionIds }),
}));

import { CommandError } from '../../../shared/lib/invokeCommand';
import { moveToBootstrap, resumeBootstrapMove } from './moveToBootstrap';

const PROJECT_ID = 'proj-cascadia' as ProjectId;
const LAP_SESSION = aSession({ goal: 'First lap' });
const BOOTSTRAP_SESSION = aSession({ goal: 'bootstrap' });
const MAIN: RemoteProbe = { kind: 'main-present', branch: 'main', sha: 'abc1234' };
const WORKTREE = '/games/cascadia/.goodboy/worktrees/goodboy-bootstrap-1a2b';

const prepared = {
  snapshotId: 'a'.repeat(40),
  snapshotRef: 'refs/goodboy/bootstrap/proj-cascadia',
  branch: 'goodboy/bootstrap',
  baseBranch: 'main',
  files: [
    { path: 'a.txt', change: 'added', size: 1 },
    { path: 'b.txt', change: 'modified', size: 2 },
  ],
  largeFiles: ['video.mp4'],
  ignoredAtRisk: { count: 1, samples: ['.env'] },
};

const mountOf = (patch: Partial<SessionProjectMount> = {}): SessionProjectMount => ({
  mountId: 'mount-bootstrap' as MountId,
  sessionId: BOOTSTRAP_SESSION.id,
  projectId: PROJECT_ID,
  mountName: 'cascadia',
  worktreePath: WORKTREE,
  lastWorktreePath: null,
  repoRoot: '/games/cascadia',
  branch: 'goodboy/bootstrap',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
  ...patch,
});

const phaseOf = (patch: Partial<BootstrapPhase> = {}): BootstrapPhase => ({
  stage: 'first-lap',
  firstLapSessionId: LAP_SESSION.id,
  bootstrapSessionId: null,
  snapshotId: null,
  worktreePath: null,
  branch: null,
  updatedAt: TEST_NOW,
  ...patch,
});

const interrupted = phaseOf({
  stage: 'moving',
  bootstrapSessionId: BOOTSTRAP_SESSION.id,
  snapshotId: prepared.snapshotId,
  worktreePath: WORKTREE,
  branch: prepared.branch,
});

type StoreOptions = {
  readonly phase?: BootstrapPhase;
  readonly probe?: RemoteProbe | null;
  readonly hasBootstrapSession?: boolean;
};

const makeStore = ({
  phase = phaseOf(),
  probe = MAIN,
  hasBootstrapSession = false,
}: StoreOptions = {}) => {
  const renameTask = vi.fn(async () => undefined);
  const archiveTask = vi.fn(async () => undefined);
  const loadProjectGitStatus = vi.fn(async () => undefined);
  const store: { state: AppStore } = {
    state: {
      ...useAppStore.getState(),
      projects: [aProject({ id: PROJECT_ID, kind: 'repo', rootPath: '/games/cascadia' })],
      sessions: hasBootstrapSession ? [LAP_SESSION, BOOTSTRAP_SESSION] : [LAP_SESSION],
      bootstrapPhase: { [PROJECT_ID]: phase },
      bootstrapRemoteProbe: probe === null ? {} : { [PROJECT_ID]: { probe, readAt: TEST_NOW } },
      renameTask,
      archiveTask,
      loadProjectGitStatus,
    },
  };
  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(store.state) : partial;
    store.state = { ...store.state, ...next };
  };
  const get: GetFn = () => store.state;
  const createSession = vi.fn(async () => {
    set({ sessionProjectMounts: { [BOOTSTRAP_SESSION.id]: [mountOf()] } });
    return { session: BOOTSTRAP_SESSION };
  });
  store.state = {
    ...store.state,
    createSession,
    setBootstrapPhase: async ({ projectId, patch }) => {
      const current = store.state.bootstrapPhase[projectId] ?? phase;
      const next = { ...current, ...patch, updatedAt: TEST_NOW };
      set({ bootstrapPhase: { ...store.state.bootstrapPhase, [projectId]: next } });
      return next;
    },
    dismissBootstrapReport: useAppStore.getState().dismissBootstrapReport,
  };
  return { store, set, get, createSession, renameTask, archiveTask };
};

beforeEach(() => {
  vi.clearAllMocks();
  h.liveSessionIds = [];
  h.prepare.mockResolvedValue(prepared);
  h.apply.mockResolvedValue(undefined);
  h.clearRoot.mockResolvedValue({ cleared: ['a.txt', 'b.txt'], kept: [] });
  h.alignMain.mockResolvedValue({ kind: 'already-aligned' });
  h.recover.mockResolvedValue({ kind: 'verified' });
  h.rollback.mockResolvedValue(undefined);
  h.discard.mockResolvedValue(undefined);
});

describe('moveToBootstrap', () => {
  it('adopts the prepared branch as a session named bootstrap, fills its worktree and finishes the phase', async () => {
    const { store, set, get, createSession, renameTask, archiveTask } = makeStore();

    const result = await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(result.kind).toBe('moved');
    expect(h.prepare).toHaveBeenCalledWith(
      expect.objectContaining({
        projectPath: '/games/cascadia',
        projectKey: PROJECT_ID,
        baseBranch: 'main',
        branch: 'goodboy/bootstrap',
      }),
    );
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        title: 'bootstrap',
        existingBranch: 'goodboy/bootstrap',
      }),
    );
    expect(renameTask).toHaveBeenCalledWith(BOOTSTRAP_SESSION.id, 'bootstrap');
    expect(h.apply).toHaveBeenCalledWith({
      projectPath: '/games/cascadia',
      snapshotId: prepared.snapshotId,
      worktreePath: WORKTREE,
      baseBranch: 'main',
    });
    expect(h.clearRoot).toHaveBeenCalledWith({
      projectPath: '/games/cascadia',
      snapshotId: prepared.snapshotId,
      worktreePath: WORKTREE,
    });
    expect(archiveTask).toHaveBeenCalledWith(LAP_SESSION.id);
    expect(store.state.bootstrapPhase[PROJECT_ID]?.stage).toBe('done');
    expect(store.state.bootstrapPhase[PROJECT_ID]?.bootstrapSessionId).toBe(BOOTSTRAP_SESSION.id);
    expect(store.state.bootstrapMoveReport[PROJECT_ID]).toMatchObject({
      movedCount: 2,
      largeFiles: ['video.mp4'],
      ignoredAtRisk: ['.env'],
      kept: [],
    });
  });

  it('copies into the worktree only after the session owns it and clears the folder last', async () => {
    const { set, get, createSession } = makeStore();
    const order: string[] = [];
    createSession.mockImplementation(async () => {
      order.push('session');
      set({ sessionProjectMounts: { [BOOTSTRAP_SESSION.id]: [mountOf()] } });
      return { session: BOOTSTRAP_SESSION };
    });
    h.apply.mockImplementation(async () => {
      order.push('apply');
    });
    h.clearRoot.mockImplementation(async () => {
      order.push('clear');
      return { cleared: [], kept: [] };
    });

    await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(order).toEqual(['session', 'apply', 'clear']);
  });

  it('refuses before touching anything when main is not on the remote', async () => {
    const { set, get } = makeStore({ probe: { kind: 'reachable-no-main' } });

    const result = await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(result).toMatchObject({ kind: 'refused', reason: 'remote-not-ready' });
    expect(h.prepare).not.toHaveBeenCalled();
  });

  it('refuses while a turn runs in the first lap session', async () => {
    h.liveSessionIds = [LAP_SESSION.id];
    const { set, get } = makeStore();

    const result = await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(result).toMatchObject({ kind: 'refused', reason: 'turn-running' });
    expect(h.prepare).not.toHaveBeenCalled();
  });

  it('refuses a project that is not in its first lap', async () => {
    const { set, get } = makeStore({ phase: phaseOf({ stage: 'done' }) });

    const result = await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(result).toMatchObject({ kind: 'refused', reason: 'not-ready' });
  });

  it('shows the git refusal and leaves the phase alone', async () => {
    h.prepare.mockRejectedValue(
      new CommandError({
        kind: 'nested_repository',
        message: 'these folders hold their own git repository: vendor/engine',
      }),
    );
    const { store, set, get, createSession } = makeStore();

    const result = await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(result).toMatchObject({ kind: 'refused', reason: 'refused' });
    expect(store.state.bootstrapPhase[PROJECT_ID]?.stage).toBe('first-lap');
    expect(createSession).not.toHaveBeenCalled();
  });

  it('names the bootstrap branch with the workspace template and prefix, without a task', async () => {
    const { set, get } = makeStore();
    const project = get().projects[0];
    if (project === undefined) {
      throw new Error('the store has no project');
    }
    set({
      workspaceOverrides: {
        [project.workspaceId]: {
          ...EMPTY_OVERRIDES,
          defaultBranchPrefix: 'team/ak',
          defaultBranchTemplate: '{prefix}/{task-id}-{slug}',
        },
      },
    });

    await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(h.prepare.mock.calls.map(([args]) => args.branch)).toEqual(['team/ak/bootstrap']);
  });

  it('takes the next name when a branch called bootstrap already exists', async () => {
    h.prepare
      .mockRejectedValueOnce(new CommandError({ kind: 'branch_taken', message: 'taken' }))
      .mockResolvedValueOnce({ ...prepared, branch: 'goodboy/bootstrap-2' });
    const { set, get, createSession } = makeStore();

    await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(h.prepare.mock.calls.map(([args]) => args.branch)).toEqual([
      'goodboy/bootstrap',
      'goodboy/bootstrap-2',
    ]);
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ existingBranch: 'goodboy/bootstrap-2' }),
    );
  });

  it('finishes the phase without a session when there is nothing to move', async () => {
    h.prepare.mockRejectedValue(new CommandError({ kind: 'nothing_to_move', message: 'nothing' }));
    const { store, set, get, createSession } = makeStore();

    const result = await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(result).toEqual({ kind: 'nothing-to-move' });
    expect(createSession).not.toHaveBeenCalled();
    expect(store.state.bootstrapPhase[PROJECT_ID]?.stage).toBe('done');
  });

  it('drops the branch and returns to the first lap when the session cannot start', async () => {
    const { store, set, get, createSession } = makeStore();
    createSession.mockRejectedValue(new Error('no provider'));

    const result = await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(result).toMatchObject({ kind: 'refused', reason: 'failed' });
    expect(h.rollback).toHaveBeenCalledWith({
      projectPath: '/games/cascadia',
      worktreePath: '',
      branch: prepared.branch,
    });
    expect(h.apply).not.toHaveBeenCalled();
    expect(h.clearRoot).not.toHaveBeenCalled();
    expect(store.state.bootstrapPhase[PROJECT_ID]?.stage).toBe('first-lap');
  });

  it('drops the branch when the moving phase cannot be stored', async () => {
    const { store, set, get, createSession } = makeStore();
    store.state = {
      ...store.state,
      setBootstrapPhase: vi.fn(async () => {
        throw new Error('database is locked');
      }),
    };

    const result = await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(result).toMatchObject({ kind: 'refused', reason: 'failed' });
    expect(h.rollback).toHaveBeenCalledWith({
      projectPath: '/games/cascadia',
      worktreePath: '',
      branch: prepared.branch,
    });
    expect(createSession).not.toHaveBeenCalled();
    expect(store.state.bootstrapPhase[PROJECT_ID]?.stage).toBe('first-lap');
  });

  it('undoes the session and the worktree when the copy does not apply, and never clears the folder', async () => {
    h.apply.mockRejectedValue(
      new CommandError({ kind: 'apply_conflict', message: 'the work does not apply: plot.txt' }),
    );
    const { store, set, get } = makeStore();

    const result = await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(result).toMatchObject({ kind: 'refused', reason: 'refused' });
    expect(h.discard).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: BOOTSTRAP_SESSION.id }),
    );
    expect(h.rollback).toHaveBeenCalledWith({
      projectPath: '/games/cascadia',
      worktreePath: WORKTREE,
      branch: prepared.branch,
    });
    expect(h.clearRoot).not.toHaveBeenCalled();
    expect(store.state.bootstrapPhase[PROJECT_ID]?.stage).toBe('first-lap');
  });

  it('keeps the phase at moving when clearing fails so the move can resume', async () => {
    h.clearRoot.mockRejectedValue(new Error('disk is read only'));
    const { store, set, get } = makeStore();

    const result = await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(result).toMatchObject({ kind: 'refused', reason: 'failed' });
    expect(store.state.bootstrapPhase[PROJECT_ID]?.stage).toBe('moving');
    expect(h.rollback).not.toHaveBeenCalled();
  });

  it('reports files that stayed because they changed again', async () => {
    h.clearRoot.mockResolvedValue({ cleared: ['a.txt'], kept: ['b.txt'] });
    const { store, set, get } = makeStore();

    await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(store.state.bootstrapMoveReport[PROJECT_ID]?.kept).toEqual(['b.txt']);
  });
});

describe('resumeBootstrapMove', () => {
  it('finishes a verified move without preparing or applying again', async () => {
    const { store, set, get } = makeStore({ phase: interrupted, hasBootstrapSession: true });

    const result = await resumeBootstrapMove(set, get)({ projectId: PROJECT_ID });

    expect(result.kind).toBe('moved');
    expect(h.prepare).not.toHaveBeenCalled();
    expect(h.apply).not.toHaveBeenCalled();
    expect(h.clearRoot).toHaveBeenCalledTimes(1);
    expect(store.state.bootstrapPhase[PROJECT_ID]?.stage).toBe('done');
  });

  it('undoes a move whose copy no longer verifies', async () => {
    h.recover.mockResolvedValue({ kind: 'mismatch', paths: ['a.txt'] });
    const { store, set, get } = makeStore({ phase: interrupted, hasBootstrapSession: true });

    const result = await resumeBootstrapMove(set, get)({ projectId: PROJECT_ID });

    expect(result).toMatchObject({ kind: 'refused', reason: 'failed' });
    expect(h.rollback).toHaveBeenCalledTimes(1);
    expect(h.clearRoot).not.toHaveBeenCalled();
    expect(store.state.bootstrapPhase[PROJECT_ID]?.stage).toBe('first-lap');
  });

  it('undoes a move that was interrupted before the session had its worktree filled', async () => {
    const { store, set, get } = makeStore({
      phase: phaseOf({ stage: 'moving', snapshotId: prepared.snapshotId, branch: prepared.branch }),
    });

    const result = await resumeBootstrapMove(set, get)({ projectId: PROJECT_ID });

    expect(result).toMatchObject({ kind: 'refused', reason: 'failed' });
    expect(h.recover).not.toHaveBeenCalled();
    expect(h.rollback).toHaveBeenCalledWith({
      projectPath: '/games/cascadia',
      worktreePath: '',
      branch: prepared.branch,
    });
    expect(store.state.bootstrapPhase[PROJECT_ID]?.stage).toBe('first-lap');
  });

  it('does nothing for a project that is not moving', async () => {
    const { set, get } = makeStore();

    const result = await resumeBootstrapMove(set, get)({ projectId: PROJECT_ID });

    expect(result).toMatchObject({ kind: 'refused', reason: 'not-ready' });
    expect(h.recover).not.toHaveBeenCalled();
  });
});
