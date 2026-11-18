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
import type {
  HistoryOriginAhead,
  IsoDateTime,
  SessionEvent,
  SessionEventId,
  WorktreeStatus,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import { rebaseStatusTargetsOf } from '../../../features/history/behindBranchesOf';
import { worktreeStatusOf } from '../../../test/worktreeStatusOf';
import {
  mountOf,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import { ensure, resetWorktreeStatusCache } from '../../runtime/worktreeStatuses/cache';
import { selectRebaseStop } from '../history/selectRebaseStop';
import type { HistoryRun, HistoryStopReason } from '../history/types';
import { readSettledStops } from './readSettledStops';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  sessionStorage.clear();
  await resetStoryStore();
  resetWorktreeStatusCache();
});

const session = sessionOf({
  goal: 'Rebase the payments branch',
  lastOpenedAt: '2026-10-06T09:00:00.000Z',
});
const sessionId = session.id;
const mount = mountOf({ session, project: paymentsApi });
const REBASED_HEAD = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const PUSHED_HEAD = 'f0e1d2c3b4a5968778695a4b3c2d1e0f98765432';
const STOP_ID = brandId<SessionEventId>({ value: 'event-origin-moved' });
const NEXT_STOP_ID = brandId<SessionEventId>({ value: 'event-origin-moved-again' });

type StatusParams = {
  readonly head: string;
  readonly ahead: number;
};

const statusAt = ({ head, ahead }: StatusParams): WorktreeStatus => ({
  ...worktreeStatusOf({ ahead }),
  head,
});

let git: WorktreeStatus = statusAt({ head: REBASED_HEAD, ahead: 3 });

const NOTHING_ONLINE: HistoryOriginAhead = {
  remoteSha: PUSHED_HEAD,
  knownRemoteSha: PUSHED_HEAD,
  commits: [],
  onlyOnline: [],
  fetchError: null,
};

type StopParams = {
  readonly at: number;
  readonly reason?: HistoryStopReason;
  readonly id?: SessionEventId;
};

const stoppedRun = ({ at, reason = 'origin-moved' }: StopParams): HistoryRun => ({
  sessionId,
  mountId: mount.mountId,
  origin: 'rebase',
  phase: 'stopped',
  planId: null,
  agentId: null,
  copyPath: null,
  stop: { reason, message: 'Someone pushed to this branch.', files: [], sha: null },
  result: null,
  backupRef: 'refs/goodboy/backup/ledger-core/1',
  remoteSha: null,
  holder: null,
  progress: null,
  applied: null,
  identity: null,
  movedHead: null,
  threadShas: [],
  commitCount: 3,
  batchId: null,
  updatedAt: at,
});

const stopEvent = ({ at, reason = 'origin-moved', id = STOP_ID }: StopParams): SessionEvent => ({
  id,
  sessionId,
  kind: 'history_stopped',
  payload: {
    mountId: mount.mountId,
    origin: 'rebase',
    reason,
    title: 'Someone pushed to this branch.',
    backupRef: 'refs/goodboy/backup/ledger-core/1',
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
  stubStoryInvoke({
    worktree_status: () => git,
    history_origin_ahead: () => NOTHING_ONLINE,
  });
};

const seedStop = (params: StopParams): void => {
  store.setState((state) => ({
    historyRuns: { ...state.historyRuns, [mount.mountId]: stoppedRun(params) },
    sessionEvents: {
      ...state.sessionEvents,
      [sessionId]: [...(state.sessionEvents?.[sessionId] ?? []), stopEvent(params)],
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

const reload = (): void => {
  store.setState({ historyRuns: {}, settledRebaseStops: readSettledStops() });
};

const card = () => selectRebaseStop({ state: store.getState(), sessionId, mountId: mount.mountId });

const PAST = (): number => Date.now() - 1_000;

describe('a stopped rebase card settles from the real git state', () => {
  it.each(['origin-moved', 'push-failed'] satisfies ReadonlyArray<HistoryStopReason>)(
    'settles %s once an agent pushed outside the card, keeps the backup, and says so once',
    async (reason) => {
      git = statusAt({ head: REBASED_HEAD, ahead: 3 });
      seed();
      seedStop({ at: PAST(), reason });
      await readGit();
      expect(card()?.run.stop?.reason).toBe(reason);

      git = statusAt({ head: PUSHED_HEAD, ahead: 0 });
      await turnEnds();

      expect(card()).toBeNull();
      expect(store.getState().historyRuns[mount.mountId]).toBeUndefined();
      expect(store.getState().settledRebaseStops[sessionId]).toEqual([STOP_ID]);
      expect(store.getState().rebaseSettleLines[mount.mountId]).toBeTypeOf('number');
      expect(store.getState().sessionEvents?.[sessionId]?.[0]?.payload?.backupRef).toBe(
        'refs/goodboy/backup/ledger-core/1',
      );
      reload();
      expect(card()).toBeNull();
    },
  );

  it('keeps the card while the branch and origin still diverge', async () => {
    git = statusAt({ head: REBASED_HEAD, ahead: 3 });
    seed();
    seedStop({ at: PAST() });
    await readGit();

    await turnEnds();

    expect(card()?.run.stop?.reason).toBe('origin-moved');
    expect(store.getState().settledRebaseStops[sessionId]).toBeUndefined();
    expect(store.getState().rebaseSettleLines[mount.mountId]).toBeUndefined();
  });

  it('shows no card when the branch already equals origin as the page opens', async () => {
    git = statusAt({ head: PUSHED_HEAD, ahead: 0 });
    seed();
    store.setState({ sessionEvents: { [sessionId]: [stopEvent({ at: PAST() })] } });
    await readGit();

    expect(card()).toBeNull();
  });

  it('drops a git read that started before the stop was recorded', async () => {
    git = statusAt({ head: PUSHED_HEAD, ahead: 0 });
    seed();
    await readGit();
    seedStop({ at: Date.now() + 1_000 });

    store.getState().settleStaleRebases({ sessionId });

    expect(card()?.run.stop?.reason).toBe('origin-moved');
    expect(store.getState().historyRuns[mount.mountId]).toBeDefined();
    expect(store.getState().settledRebaseStops[sessionId]).toBeUndefined();
  });

  it('settles in a second window that only has the saved event', async () => {
    git = statusAt({ head: PUSHED_HEAD, ahead: 0 });
    seed();
    store.setState({ sessionEvents: { [sessionId]: [stopEvent({ at: PAST() })] } });
    await readGit();

    await turnEnds();

    expect(store.getState().settledRebaseStops[sessionId]).toEqual([STOP_ID]);
    expect(card()).toBeNull();
  });
});

describe('dismissing a rebase card', () => {
  it('hides the card, survives a reload, and a new stop shows again', async () => {
    git = statusAt({ head: REBASED_HEAD, ahead: 3 });
    seed();
    seedStop({ at: PAST() - 1_000 });
    await readGit();

    store.getState().dismissRebaseCard({ sessionId, mountId: mount.mountId });

    expect(card()).toBeNull();
    reload();
    expect(card()).toBeNull();

    seedStop({ at: Date.now(), id: NEXT_STOP_ID });
    expect(card()?.run.stop?.reason).toBe('origin-moved');
    store.setState({ historyRuns: {} });
    expect(card()?.eventId).toBe(NEXT_STOP_ID);
  });

  it('settles the older stop when Rebase on their commits finishes, so Dismiss leaves nothing', async () => {
    git = statusAt({ head: REBASED_HEAD, ahead: 3 });
    seed();
    seedStop({ at: PAST() });
    await readGit();

    const outcome = await store
      .getState()
      .bringOriginIntoHistory({ sessionId, mountId: mount.mountId });

    expect(outcome).toBe('nothing');
    expect(card()?.run.phase).toBe('applied');
    store.getState().dismissRebaseCard({ sessionId, mountId: mount.mountId });
    expect(card()).toBeNull();
    reload();
    expect(card()).toBeNull();
  });
});
