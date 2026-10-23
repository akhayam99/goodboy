// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId } from '@goodboy/types';
import type { IsoDateTime, SessionEvent, SessionEventId, WorktreeStatus } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import { rebaseStatusTargetsOf } from '../../../features/history/behindBranchesOf';
import { rebaseConflictOf } from '../../../features/history/rebaseConflictOf';
import { mountRebaseConflictOf } from '../../../features/actions/kinds/mountRebaseConflictOf';
import { worktreeStatusOf } from '../../../test/worktreeStatusOf';
import {
  mountOf,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import { ensure, resetWorktreeStatusCache } from '../worktreeStatuses/cache';
import type { HistoryRun } from '../history/types';
import type { RebaseAllBranchState } from './types';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
});

const session = sessionOf({
  goal: 'Rebase the payments branch',
  lastOpenedAt: '2026-10-06T09:00:00.000Z',
});
const sessionId = session.id;
const mount = mountOf({ session, project: paymentsApi });
const OLD_HEAD = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const NEW_HEAD = 'f0e1d2c3b4a5968778695a4b3c2d1e0f98765432';
const STOP_ID = brandId<SessionEventId>({ value: 'event-rebase-stop' });

type StatusParams = {
  readonly head: string;
  readonly behind?: number;
  readonly unmerged?: number;
  readonly inProgress?: WorktreeStatus['inProgress'];
};

const statusAt = ({ head, behind = 0, unmerged = 0, inProgress = null }: StatusParams) => ({
  ...worktreeStatusOf({ behind, unmerged, inProgress }),
  head,
});

let git: WorktreeStatus = statusAt({ head: OLD_HEAD, behind: 3 });

type AtParams = {
  readonly at: number;
};

const conflictRun = ({ at }: AtParams): HistoryRun => ({
  sessionId,
  mountId: mount.mountId,
  origin: 'rebase',
  phase: 'stopped',
  planId: null,
  agentId: null,
  copyPath: null,
  stop: {
    reason: 'conflict',
    message: 'Rebasing on main stops on 2 files',
    files: ['src/ledger.ts', 'src/postings.ts'],
    sha: 'c0ffee',
    head: OLD_HEAD,
  },
  result: null,
  backupRef: null,
  remoteSha: null,
  holder: null,
  progress: null,
  applied: null,
  identity: null,
  movedHead: null,
  threadShas: [],
  commitCount: 3,
  batchId: 'run-1',
  rebaseConflict: { ontoRef: 'origin/main', baseBranch: 'main', head: OLD_HEAD, autoAgentId: null },
  updatedAt: at,
});

const stopEvent = ({ at }: AtParams): SessionEvent => ({
  id: STOP_ID,
  sessionId,
  kind: 'history_stopped',
  payload: {
    mountId: mount.mountId,
    origin: 'rebase',
    reason: 'conflict',
    title: 'Rebasing on main stops on 2 files',
    head: OLD_HEAD,
  },
  createdAt: brandId<IsoDateTime>({ value: new Date(at).toISOString() }),
});

const seed = (): void => {
  seedColumn({
    store,
    sessions: [session],
    currentSessionId: sessionId,
    mounts: [[session, paymentsApi]],
  });
  stubStoryInvoke({ worktree_status: () => git });
};

const seedStop = ({ at }: AtParams): void => {
  store.setState((state) => ({
    historyRuns: { ...state.historyRuns, [mount.mountId]: conflictRun({ at }) },
    sessionEvents: { ...state.sessionEvents, [sessionId]: [stopEvent({ at })] },
    rebaseAllRuns: {
      [sessionId]: {
        id: 'run-1',
        sessionId,
        startedAt: at,
        shouldTidy: false,
        isAborted: false,
        phase: 'done',
        autoAgentId: null,
        error: null,
        branches: [
          {
            mountId: mount.mountId,
            projectName: 'payments-api',
            branch: mount.branch,
            state: 'conflict',
            message: null,
          },
        ],
      },
    },
  }));
};

const readGit = async (): Promise<void> => {
  const state = store.getState();
  for (const target of rebaseStatusTargetsOf({
    mounts: state.sessionProjectMounts[sessionId] ?? [],
    projects: state.projects,
  })) {
    await ensure({
      key: target.key,
      worktreePath: target.worktreePath,
      baseBranch: target.baseBranch ?? undefined,
      maxAgeMs: 0,
    });
  }
};

const turnEnds = async (): Promise<void> => {
  await store.getState().recheckSessionMounts({ sessionId, reason: 'turn-end' });
};

const branchState = (): RebaseAllBranchState | undefined =>
  store.getState().rebaseAllRuns[sessionId]?.branches[0]?.state;

const isConflictShown = (): boolean =>
  rebaseConflictOf({ run: store.getState().historyRuns[mount.mountId] }) !== null;

const PAST = (): number => Date.now() - 1_000;

describe('a rebase stop is settled from the real git state', () => {
  it('keeps Conflict while the worktree still sits where the rebase stopped', async () => {
    git = statusAt({ head: OLD_HEAD, behind: 3 });
    seed();
    seedStop({ at: PAST() });
    await readGit();

    await turnEnds();

    expect(isConflictShown()).toBe(true);
    expect(branchState()).toBe('conflict');
    expect(store.getState().settledRebaseStops[sessionId]).toBeUndefined();
  });

  it('drops Conflict everywhere once an agent rebased the worktree and its turn ended', async () => {
    git = statusAt({ head: OLD_HEAD, behind: 3 });
    seed();
    seedStop({ at: PAST() });
    await readGit();

    git = statusAt({ head: NEW_HEAD, behind: 0 });
    await turnEnds();

    expect(isConflictShown()).toBe(false);
    expect(mountRebaseConflictOf({ run: store.getState().historyRuns[mount.mountId] })).toBeNull();
    expect(branchState()).toBe('rebased');
    expect(store.getState().settledRebaseStops[sessionId]).toEqual([STOP_ID]);
  });

  it('keeps Conflict while the agent rebase is still in progress with unmerged files', async () => {
    git = statusAt({ head: OLD_HEAD, behind: 3 });
    seed();
    seedStop({ at: PAST() });
    await readGit();

    git = statusAt({ head: NEW_HEAD, behind: 1, unmerged: 2, inProgress: 'rebase' });
    await turnEnds();

    expect(isConflictShown()).toBe(true);
    expect(branchState()).toBe('conflict');
    expect(store.getState().settledRebaseStops[sessionId]).toBeUndefined();
  });

  it('keeps Conflict after an unrelated commit that leaves the branch behind its base', async () => {
    git = statusAt({ head: OLD_HEAD, behind: 3 });
    seed();
    seedStop({ at: PAST() });
    await readGit();

    git = statusAt({ head: NEW_HEAD, behind: 3 });
    await turnEnds();

    expect(isConflictShown()).toBe(true);
    expect(branchState()).toBe('conflict');
    expect(store.getState().settledRebaseStops[sessionId]).toBeUndefined();
  });

  it('keeps Conflict when the agent aborted and the branch is back where it stopped', async () => {
    git = statusAt({ head: OLD_HEAD, behind: 3 });
    seed();
    seedStop({ at: PAST() });
    await readGit();

    git = statusAt({ head: OLD_HEAD, behind: 3 });
    await turnEnds();

    expect(isConflictShown()).toBe(true);
    expect(branchState()).toBe('conflict');
  });

  it('drops a git read that started before the stop was recorded', async () => {
    git = statusAt({ head: NEW_HEAD, behind: 0 });
    seed();
    await readGit();
    seedStop({ at: Date.now() + 1_000 });

    store.getState().settleStaleRebases({ sessionId });

    expect(isConflictShown()).toBe(true);
    expect(branchState()).toBe('conflict');
    expect(store.getState().settledRebaseStops[sessionId]).toBeUndefined();
  });

  it('stays settled when the base moves again after the agent rebased', async () => {
    git = statusAt({ head: OLD_HEAD, behind: 3 });
    seed();
    seedStop({ at: PAST() });
    await readGit();
    git = statusAt({ head: NEW_HEAD, behind: 0 });
    await turnEnds();

    git = statusAt({ head: NEW_HEAD, behind: 2 });
    await turnEnds();

    expect(isConflictShown()).toBe(false);
    expect(branchState()).toBe('rebased');
    expect(store.getState().settledRebaseStops[sessionId]).toEqual([STOP_ID]);
  });

  it('settles the same stop in a second window that only has the saved event', async () => {
    git = statusAt({ head: NEW_HEAD, behind: 0 });
    seed();
    store.setState({ sessionEvents: { [sessionId]: [stopEvent({ at: PAST() })] } });
    await readGit();

    await turnEnds();

    expect(store.getState().settledRebaseStops[sessionId]).toEqual([STOP_ID]);
    expect(store.getState().historyRuns[mount.mountId]).toBeUndefined();
  });

  it('leaves a stop handed to Auto alone, since its card already reads git', async () => {
    git = statusAt({ head: OLD_HEAD, behind: 3 });
    seed();
    seedStop({ at: PAST() });
    store.setState((state) => {
      const run = state.historyRuns[mount.mountId];
      if (run?.rebaseConflict === undefined) {
        return {};
      }
      return {
        historyRuns: {
          ...state.historyRuns,
          [mount.mountId]: {
            ...run,
            rebaseConflict: {
              ...run.rebaseConflict,
              autoAgentId: brandId({ value: 'agent-auto' }),
            },
          },
        },
      };
    });
    await readGit();

    git = statusAt({ head: NEW_HEAD, behind: 0 });
    await turnEnds();

    expect(store.getState().historyRuns[mount.mountId]?.rebaseConflict?.autoAgentId).toBe(
      'agent-auto',
    );
    expect(store.getState().settledRebaseStops[sessionId]).toEqual([STOP_ID]);
  });
});
