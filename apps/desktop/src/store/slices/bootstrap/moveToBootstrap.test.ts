// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BootstrapPhase, ProjectId, RemoteProbe } from '@goodboy/types';
import { aProject, aSession, TEST_NOW } from '@goodboy/types/testing';
import { useAppStore, type AppStore } from '../../store';
import type { GetFn, SetFn } from '../../slice-types';

const h = vi.hoisted(() => ({
  setSetting: vi.fn(async () => undefined),
  prepare: vi.fn(),
  clearRoot: vi.fn(),
  alignMain: vi.fn(),
  recover: vi.fn(),
  rollback: vi.fn(),
  liveSessionIds: [] as string[],
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({ setSetting: h.setSetting }),
);
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../shared/lib/repo', () => ({
  bootstrapPrepare: h.prepare,
  bootstrapClearRoot: h.clearRoot,
  bootstrapAlignMain: h.alignMain,
  bootstrapRecover: h.recover,
  bootstrapRollback: h.rollback,
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

const prepared = {
  snapshotId: 'a'.repeat(40),
  snapshotRef: 'refs/goodboy/bootstrap/proj-cascadia',
  worktreePath: '/games/cascadia/.goodboy/worktrees/bootstrap',
  branch: 'goodboy/bootstrap',
  baseBranch: 'main',
  files: [
    { path: 'a.txt', change: 'added', size: 1 },
    { path: 'b.txt', change: 'modified', size: 2 },
  ],
  largeFiles: ['video.mp4'],
  ignoredAtRisk: { count: 1, samples: ['.env'] },
};

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

const makeStore = ({ phase = phaseOf(), probe = MAIN as RemoteProbe | null } = {}) => {
  const createSession = vi.fn(async () => ({ session: BOOTSTRAP_SESSION }));
  const renameTask = vi.fn(async () => undefined);
  const archiveTask = vi.fn(async () => undefined);
  const loadProjectGitStatus = vi.fn(async () => undefined);
  const store: { state: AppStore } = {
    state: {
      ...useAppStore.getState(),
      projects: [aProject({ id: PROJECT_ID, kind: 'repo', rootPath: '/games/cascadia' })],
      sessions: [LAP_SESSION],
      bootstrapPhase: { [PROJECT_ID]: phase },
      bootstrapRemoteProbe: probe === null ? {} : { [PROJECT_ID]: { probe, readAt: TEST_NOW } },
      createSession,
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
  const slice = useAppStore.getState();
  store.state = {
    ...store.state,
    setBootstrapPhase: async ({ projectId, patch }) => {
      const current = store.state.bootstrapPhase[projectId] ?? phase;
      const next = { ...current, ...patch, updatedAt: TEST_NOW };
      set({ bootstrapPhase: { ...store.state.bootstrapPhase, [projectId]: next } });
      return next;
    },
    dismissBootstrapReport: slice.dismissBootstrapReport,
  };
  return { store, set, get, createSession, renameTask, archiveTask };
};

beforeEach(() => {
  vi.clearAllMocks();
  h.liveSessionIds = [];
  h.prepare.mockResolvedValue(prepared);
  h.clearRoot.mockResolvedValue({ cleared: ['a.txt', 'b.txt'], kept: [] });
  h.alignMain.mockResolvedValue({ kind: 'already-aligned' });
  h.recover.mockResolvedValue({ kind: 'verified' });
  h.rollback.mockResolvedValue(undefined);
});

describe('moveToBootstrap', () => {
  it('moves the work, adopts the worktree as a session named bootstrap and finishes the phase', async () => {
    const { store, set, get, createSession, renameTask, archiveTask } = makeStore();

    const result = await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(result.kind).toBe('moved');
    expect(h.prepare).toHaveBeenCalledWith(
      expect.objectContaining({
        projectPath: '/games/cascadia',
        projectKey: PROJECT_ID,
        baseBranch: 'main',
        slug: 'bootstrap',
      }),
    );
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        title: 'bootstrap',
        existingBranch: 'goodboy/bootstrap',
        folderName: 'bootstrap',
      }),
    );
    expect(renameTask).toHaveBeenCalledWith(BOOTSTRAP_SESSION.id, 'bootstrap');
    expect(h.clearRoot).toHaveBeenCalledWith({
      projectPath: '/games/cascadia',
      snapshotId: prepared.snapshotId,
      worktreePath: prepared.worktreePath,
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

  it('clears the project folder only after the session exists', async () => {
    const { set, get, createSession } = makeStore();
    const order: string[] = [];
    createSession.mockImplementation(async () => {
      order.push('session');
      return { session: BOOTSTRAP_SESSION };
    });
    h.clearRoot.mockImplementation(async () => {
      order.push('clear');
      return { cleared: [], kept: [] };
    });

    await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(order).toEqual(['session', 'clear']);
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

  it('takes the next name when a branch called bootstrap already exists', async () => {
    h.prepare
      .mockRejectedValueOnce(new CommandError({ kind: 'branch_taken', message: 'taken' }))
      .mockResolvedValueOnce({
        ...prepared,
        branch: 'goodboy/bootstrap-2',
        worktreePath: '/games/cascadia/.goodboy/worktrees/bootstrap-2',
      });
    const { set, get, createSession } = makeStore();

    await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(h.prepare.mock.calls.map(([args]) => args.slug)).toEqual(['bootstrap', 'bootstrap-2']);
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ existingBranch: 'goodboy/bootstrap-2', folderName: 'bootstrap-2' }),
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

  it('undoes the worktree and returns to the first lap when the session cannot start', async () => {
    const { store, set, get, createSession } = makeStore();
    createSession.mockRejectedValue(new Error('no provider'));

    const result = await moveToBootstrap(set, get)({ projectId: PROJECT_ID });

    expect(result).toMatchObject({ kind: 'refused', reason: 'failed' });
    expect(h.rollback).toHaveBeenCalledWith({
      projectPath: '/games/cascadia',
      worktreePath: prepared.worktreePath,
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
  const interrupted = phaseOf({
    stage: 'moving',
    snapshotId: prepared.snapshotId,
    worktreePath: prepared.worktreePath,
    branch: prepared.branch,
  });

  it('finishes a verified move without cutting a second worktree', async () => {
    const { store, set, get } = makeStore({ phase: interrupted });

    const result = await resumeBootstrapMove(set, get)({ projectId: PROJECT_ID });

    expect(result.kind).toBe('moved');
    expect(h.prepare).not.toHaveBeenCalled();
    expect(h.clearRoot).toHaveBeenCalledTimes(1);
    expect(store.state.bootstrapPhase[PROJECT_ID]?.stage).toBe('done');
  });

  it('undoes a move whose copy no longer verifies', async () => {
    h.recover.mockResolvedValue({ kind: 'mismatch', paths: ['a.txt'] });
    const { store, set, get } = makeStore({ phase: interrupted });

    const result = await resumeBootstrapMove(set, get)({ projectId: PROJECT_ID });

    expect(result).toMatchObject({ kind: 'refused', reason: 'failed' });
    expect(h.rollback).toHaveBeenCalledTimes(1);
    expect(h.clearRoot).not.toHaveBeenCalled();
    expect(store.state.bootstrapPhase[PROJECT_ID]?.stage).toBe('first-lap');
  });

  it('returns to the first lap when it was interrupted before anything was copied', async () => {
    const { store, set, get } = makeStore({ phase: phaseOf({ stage: 'moving' }) });

    await resumeBootstrapMove(set, get)({ projectId: PROJECT_ID });

    expect(h.recover).not.toHaveBeenCalled();
    expect(store.state.bootstrapPhase[PROJECT_ID]?.stage).toBe('first-lap');
  });

  it('does nothing for a project that is not moving', async () => {
    const { set, get } = makeStore();

    const result = await resumeBootstrapMove(set, get)({ projectId: PROJECT_ID });

    expect(result).toMatchObject({ kind: 'refused', reason: 'not-ready' });
    expect(h.recover).not.toHaveBeenCalled();
  });
});
