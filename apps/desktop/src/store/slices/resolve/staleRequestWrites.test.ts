import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type MountId } from '@goodboy/types';
import { aSession, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storyResolveQueries,
  type StoryStore,
} from '../../storyHarness';
import { syncSourceThreads } from '../review-source/syncSourceThreads';
import { createResolveThread } from './createResolveThread';
import { newQueueItem } from './newQueueItem';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    setResolveThreadSourceSnapshot: vi.fn(async () => true),
  }),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../features/onboarding/onboardingSettings', async () =>
  (await import('../../storyHarness')).onboardingStoreModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../storyHarness')).repoModuleMock(),
);
vi.mock('../../../shared/lib/editor', async () =>
  (await import('../../storyHarness')).editorModuleMock(),
);
vi.mock('../../../features/plans/plans', async () =>
  (await import('../../storyHarness')).plansModuleMock(),
);
vi.mock('../../../features/integrations/linear/client', async () =>
  (await import('../../storyHarness')).linearClientModuleMock(),
);
vi.mock('../../../features/integrations/github/github', async () =>
  (await import('../../storyHarness')).githubModuleMock(),
);
vi.mock('@goodboy/core', async (importOriginal) =>
  (await import('../../storyHarness')).coreModuleMock(importOriginal),
);
vi.mock('../../../features/scripts/scripts', async () =>
  (await import('../../storyHarness')).scriptsModuleMock(),
);
vi.mock('../../../features/terminal/terminal', async () =>
  (await import('../../storyHarness')).terminalModuleMock(),
);
vi.mock('../../../features/settings/config-export', async () =>
  (await import('../../storyHarness')).configExportModuleMock(),
);

let store: StoryStore;

const SESSION = aSession({
  workspaceId: aWorkspace({ name: 'Harborline', slug: 'harborline' }).id,
});
const PR_NUMBER = 7;
const LEDGER_MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });
const resolveRows = storyResolveQueries.listResolveThreads;
const queueItems = storyResolveQueries.listResolveQueueItems;
const candidatesRead = storyResolveQueries.listResolveCandidates;
const factsRead = storyResolveQueries.listResolveThreadFacts;
const attemptsRead = storyResolveQueries.listResolveAttempts;

type Rows = Awaited<ReturnType<typeof resolveRows>>;
type Items = Awaited<ReturnType<typeof queueItems>>;
type Candidates = Awaited<ReturnType<typeof candidatesRead>>;
type Facts = Awaited<ReturnType<typeof factsRead>>;
type Attempts = Awaited<ReturnType<typeof attemptsRead>>;

type GateParams<T> = { readonly value: T };
type Gate<T> = {
  readonly promise: Promise<T>;
  readonly release: () => void;
};

const gateOf = <T>({ value }: GateParams<T>): Gate<T> => {
  let release: () => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    release = () => resolve(value);
  });
  return { promise, release };
};

const flush = async (): Promise<void> => {
  for (let tick = 0; tick < 400; tick += 1) {
    await Promise.resolve();
  }
};

type ReviewParams = { readonly id: string; readonly threadId: string };

const review = ({ id, threadId }: ReviewParams) => ({
  id,
  author: 'kenji-w',
  authorAvatarUrl: null,
  body: 'Keep the retry count here',
  createdAt: TEST_NOW,
  url: '',
  source: 'review' as const,
  threadId,
  resolved: false,
});

const handReplyComments = () => [
  review({ id: 'r1', threadId: 'T1' }),
  {
    ...review({ id: 'r2', threadId: 'T1' }),
    author: 'nadia',
    body: 'Looks good',
    inReplyToId: 'r1',
  },
];

const draftRow = () => ({
  ...createResolveThread({
    sessionId: SESSION.id,
    threadId: 'T1',
    prNumber: PR_NUMBER,
    sourceKind: 'github',
  }),
  replyDraft: 'Looks good',
});

type LaneParams = { readonly id: string; readonly revision: number };

const readyCandidate = ({ id, revision }: LaneParams): Candidates[number] => ({
  id,
  sessionId: SESSION.id,
  revision,
  baseSha: 'root',
  candidateSha: `sha-${id}`,
  worktreePath: '/repo/ledger-core',
  mountTarget: { mountId: LEDGER_MOUNT, mountRevision: 1, worktreePath: '/repo/ledger-core' },
  state: 'ready',
  integratedSha: null,
  createdAt: revision,
  updatedAt: revision,
});

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resolveRows.mockReset();
  resolveRows.mockImplementation(async () => []);
  queueItems.mockReset();
  queueItems.mockImplementation(async () => []);
  candidatesRead.mockReset();
  candidatesRead.mockImplementation(async () => []);
  factsRead.mockReset();
  factsRead.mockImplementation(async () => []);
  attemptsRead.mockReset();
  attemptsRead.mockImplementation(async () => []);
  storyResolveQueries.upsertResolveThread.mockClear();
  storyResolveQueries.setResolveThreadReplyPosted.mockClear();
  storyResolveQueries.setResolveCandidateState.mockClear();
  store.setState({
    githubStatus: { mode: 'gh-cli', available: true, user: 'nadia' },
    sessionResolveQueueItems: {},
    sessionResolveThreads: {},
    sessionResolveCandidates: {},
    sessionResolveSourceSnapshots: {},
  });
});

describe('resolve helpers under a request that went stale', () => {
  it('saves no new thread row inside the stored row read', async () => {
    const gate = gateOf<Rows>({ value: [] });
    resolveRows.mockImplementationOnce(async () => []).mockImplementationOnce(() => gate.promise);
    let isLive = true;

    const running = store.getState().materializeReviewThreads({
      sessionId: SESSION.id,
      prNumber: PR_NUMBER,
      projectId: null,
      comments: [review({ id: 'c1', threadId: 'gitlab:d1' })],
      sourceKind: 'gitlab',
      isCurrent: () => isLive,
    });
    await flush();
    isLive = false;
    gate.release();
    await running;

    expect(storyResolveQueries.upsertResolveThread).not.toHaveBeenCalled();
  });

  it('leaves the queue in the store alone inside the queue read', async () => {
    const gate = gateOf<Items>({ value: [] });
    queueItems.mockImplementationOnce(async () => []).mockImplementationOnce(() => gate.promise);
    let isLive = true;

    const running = store.getState().materializeReviewThreads({
      sessionId: SESSION.id,
      prNumber: PR_NUMBER,
      projectId: null,
      comments: [review({ id: 'c1', threadId: 'gitlab:d1' })],
      sourceKind: 'gitlab',
      isCurrent: () => isLive,
    });
    await flush();
    isLive = false;
    gate.release();
    await running;

    expect(store.getState().sessionResolveQueueItems[SESSION.id]).toBeUndefined();
  });

  it('marks no hand reply inside the thread read', async () => {
    const gate = gateOf<Rows>({ value: [draftRow()] });
    resolveRows.mockImplementationOnce(() => gate.promise);
    let isLive = true;

    const running = store.getState().reconcileHandReplies({
      sessionId: SESSION.id,
      prNumber: PR_NUMBER,
      comments: handReplyComments(),
      isCurrent: () => isLive,
    });
    await flush();
    isLive = false;
    gate.release();
    await running;

    expect(storyResolveQueries.setResolveThreadReplyPosted).not.toHaveBeenCalled();
  });

  it('projects no rows after hand replies inside the final read', async () => {
    const row = draftRow();
    await storyResolveQueries.upsertResolveThread({ row, expectedRevision: null });
    resolveRows.mockImplementation(async () => [row]);
    const gate = gateOf<Attempts>({ value: [] });
    attemptsRead.mockImplementationOnce(() => gate.promise);
    let isLive = true;

    const running = store.getState().reconcileHandReplies({
      sessionId: SESSION.id,
      prNumber: PR_NUMBER,
      comments: handReplyComments(),
      isCurrent: () => isLive,
    });
    await flush();
    isLive = false;
    gate.release();
    await running;

    expect(storyResolveQueries.setResolveThreadReplyPosted).toHaveBeenCalledTimes(1);
    expect(store.getState().sessionResolveThreads[SESSION.id]).toBeUndefined();
  });

  it('stores no source snapshot inside the facts read', async () => {
    const row = createResolveThread({
      sessionId: SESSION.id,
      threadId: 'T1',
      prNumber: PR_NUMBER,
      sourceKind: 'gitlab',
    });
    resolveRows.mockImplementation(async () => [row]);
    const gate = gateOf<Facts>({ value: [] });
    factsRead.mockImplementationOnce(() => gate.promise);
    const { setResolveThreadSourceSnapshot } = await import('@goodboy/db');
    const snapshotWrite = vi.mocked(setResolveThreadSourceSnapshot);
    snapshotWrite.mockClear();
    let isLive = true;

    const running = store.getState().syncSourceSnapshots({
      sessionId: SESSION.id,
      prNumber: PR_NUMBER,
      comments: [review({ id: 'c1', threadId: 'T1' })],
      isCurrent: () => isLive,
    });
    await flush();
    isLive = false;
    gate.release();
    await running;

    expect(snapshotWrite).not.toHaveBeenCalled();
  });

  it('leaves the source snapshots in the store alone inside their read', async () => {
    const gate = gateOf<Facts>({ value: [] });
    factsRead.mockImplementationOnce(async () => []).mockImplementationOnce(() => gate.promise);
    let isLive = true;

    const running = store.getState().syncSourceSnapshots({
      sessionId: SESSION.id,
      prNumber: PR_NUMBER,
      comments: [],
      isCurrent: () => isLive,
    });
    await flush();
    isLive = false;
    gate.release();
    await running;

    expect(store.getState().sessionResolveSourceSnapshots[SESSION.id]).toBeUndefined();
  });
});

type QueueItem = Items[number]['item'];
type ItemsParams = { readonly items: Map<string, QueueItem> };
type ItemStateParams = ItemsParams & {
  readonly itemId: string;
  readonly state: QueueItem['approvalState'];
};
type LaneWorld = ItemsParams & { readonly discarded: Set<string> };

const LANE_THREAD = createResolveThread({
  sessionId: SESSION.id,
  threadId: 'T2',
  prNumber: PR_NUMBER,
  sourceKind: 'github',
});

const setItemState = ({ items, itemId, state }: ItemStateParams): void => {
  const item = items.get(itemId);
  if (item !== undefined) {
    items.set(itemId, { ...item, approvalState: state });
  }
};

const laneEntriesOf = ({ items }: ItemsParams): Items =>
  [...items.values()].map((item) => ({ item, thread: LANE_THREAD }));

const laneWorldOf = (): LaneWorld => {
  const items = new Map<string, QueueItem>();
  const discarded = new Set<string>();
  items.set('item-T2', {
    ...newQueueItem({ sessionId: SESSION.id, threadId: 'T2', candidateRevision: 0 }),
    id: 'item-T2',
    approvalState: 'deferred',
    deferredAt: 1,
  });
  candidatesRead.mockImplementation(async () =>
    [
      readyCandidate({ id: 'one', revision: 1 }),
      readyCandidate({ id: 'beside', revision: 2 }),
    ].filter((candidate) => !discarded.has(candidate.id)),
  );
  storyResolveQueries.listResolveCandidateItems.mockImplementation(async () => [
    { candidateId: 'beside', queueItemId: 'item-T2', itemRevision: 0 },
  ]);
  queueItems.mockImplementation(async () => laneEntriesOf({ items }));
  storyResolveQueries.setResolveCandidateState.mockImplementation(async ({ candidateId }) => {
    discarded.add(candidateId);
    return true;
  });
  storyResolveQueries.undeferResolveQueueItem.mockImplementation(async ({ itemId }) => {
    setItemState({ items, itemId, state: 'none' });
    return true;
  });
  storyResolveQueries.deferResolveQueueItem.mockImplementation(
    async ({ itemId, expectedState }) => {
      const current = items.get(itemId)?.approvalState;
      if (expectedState != null && current !== expectedState) {
        return false;
      }
      setItemState({ items, itemId, state: 'deferred' });
      return true;
    },
  );
  return { items, discarded };
};

type SyncParams = { readonly isCurrent: () => boolean };

const syncLane = ({ isCurrent }: SyncParams): Promise<void> =>
  syncSourceThreads({
    get: store.getState,
    sessionId: SESSION.id,
    mountId: LEDGER_MOUNT,
    kind: 'github',
    prNumber: PR_NUMBER,
    projectId: null,
    comments: [],
    isCurrent,
  });

describe('the lane reconcile is a step over database state, not over the response', () => {
  it('rebuilds the discarded candidate although a newer refresh began', async () => {
    laneWorldOf();
    const gate = gateOf<boolean>({ value: true });
    storyResolveQueries.setResolveCandidateState.mockImplementationOnce(async () => gate.promise);
    let isLive = true;

    const running = syncLane({ isCurrent: () => isLive });
    await flush();
    isLive = false;
    gate.release();
    await running;

    expect(storyResolveQueries.undeferResolveQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'item-T2' }),
    );
  });

  it('keeps a newer refusal when the lane rebuild fails afterwards', async () => {
    const world = laneWorldOf();
    const gate = gateOf<boolean>({ value: true });
    let hasTakenUp = false;
    let hasPaused = false;
    storyResolveQueries.undeferResolveQueueItem.mockImplementation(async ({ itemId }) => {
      setItemState({ items: world.items, itemId, state: 'none' });
      hasTakenUp = true;
      return true;
    });
    queueItems.mockImplementation(async () => {
      if (hasTakenUp && !hasPaused) {
        hasPaused = true;
        await gate.promise;
      }
      return laneEntriesOf({ items: world.items });
    });
    let isLive = true;

    const running = syncLane({ isCurrent: () => isLive });
    await flush();
    isLive = false;
    setItemState({ items: world.items, itemId: 'item-T2', state: 'wont_fix' });
    gate.release();
    await running;

    expect(world.items.get('item-T2')?.approvalState).toBe('wont_fix');
    expect(storyResolveQueries.deferResolveQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'item-T2', expectedState: 'none' }),
    );
  });

  it('never runs two lane reconciles at once when refreshes overlap', async () => {
    laneWorldOf();
    const gate = gateOf<boolean>({ value: true });
    storyResolveQueries.setResolveCandidateState.mockImplementationOnce(async () => gate.promise);

    const first = syncLane({ isCurrent: () => true });
    await flush();
    const readsWhilePaused = candidatesRead.mock.calls.length;
    const second = syncLane({ isCurrent: () => true });
    await flush();

    expect(candidatesRead.mock.calls.length).toBe(readsWhilePaused);
    gate.release();
    await Promise.all([first, second]);
    expect(candidatesRead.mock.calls.length).toBeGreaterThan(readsWhilePaused);
  });
});
