// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import {
  insertResolveQueueItem,
  listResolveQueueItems,
  upsertResolveThread,
  type Database,
} from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import type { ResolveQueueItem, ResolveStage, ResolveThread, SessionId } from '@goodboy/types';
import { useAppStore, type AppStore } from '../../store';
import { createResolveSlice } from '../resolve';
import { createUndoSlice } from '../undo';
import { createReviewBulkSlice } from './index';

const h = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
  exec: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: h }));

const sessionId = 'session' as SessionId;

const threadOf = ({ id, stage }: { readonly id: string; readonly stage: ResolveStage }) =>
  ({
    id: `row-${id}`,
    sessionId,
    projectId: null,
    prNumber: 1,
    threadId: id,
    originKind: 'review_comment',
    diffCommentId: null,
    state: stage === 'new' ? 'open' : stage === 'working' ? 'working' : 'fixed',
    stage,
    stateReason: null,
    revision: 2,
    generation: 0,
    reopenedFromThreadId: null,
    activeAttemptId: null,
    disposition: 'reply',
    replyDraft: `Reply for ${id}`,
    commitShas: null,
    fixupOfSha: null,
    replacesSha: null,
    question: null,
    replyPostedAt: null,
    replyId: null,
    githubResolved: null,
    closedAt: null,
    closedSource: null,
    createdAt: 1,
    updatedAt: 1,
  }) satisfies ResolveThread;

const itemOf = ({ id }: { readonly id: string }): ResolveQueueItem => ({
  id: `item-${id}`,
  sessionId,
  threadId: id,
  generation: 0,
  reopenedFromItemId: null,
  candidateRevision: 2,
  approvalState: 'none',
  approvedRevision: null,
  approvedReplyHash: null,
  integratedSha: null,
  deferredAt: null,
  deliveredAt: null,
  supersededAt: null,
  createdAt: 1,
  updatedAt: 1,
});

const SEEDED: ReadonlyArray<{ readonly id: string; readonly stage: ResolveStage }> = [
  { id: 'a', stage: 'proposed' },
  { id: 'b', stage: 'proposed' },
  { id: 'c', stage: 'proposed' },
  { id: 'd', stage: 'new' },
  { id: 'e', stage: 'working' },
];

let db: Database;

const harness = async () => {
  const store = createStore<AppStore>((set, get) => ({
    ...useAppStore.getInitialState(),
    ...createResolveSlice({ set, get }),
    ...createUndoSlice({ set, get }),
    ...createReviewBulkSlice({ set, get }),
  }));
  await store.getState().loadResolveSession({ sessionId });
  return store;
};

const approvalOf = async ({ id }: { readonly id: string }): Promise<string | undefined> =>
  (await listResolveQueueItems({ db, sessionId })).find((entry) => entry.thread.threadId === id)
    ?.item.approvalState;

const stageOf = async ({ id }: { readonly id: string }): Promise<string | undefined> =>
  (await listResolveQueueItems({ db, sessionId })).find((entry) => entry.thread.threadId === id)
    ?.thread.stage;

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  h.exec.mockReset().mockImplementation(db.exec);
  h.execute.mockReset().mockImplementation(db.execute);
  h.select.mockReset().mockImplementation(db.select);
  h.transaction.mockReset().mockImplementation(db.transaction);
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  for (const seed of SEEDED) {
    await upsertResolveThread({ db, row: threadOf(seed), expectedRevision: null });
    await insertResolveQueueItem({ db, item: itemOf(seed) });
  }
});

describe('review bulk accept', () => {
  it('accepts every ready comment in one action and leaves the rest alone', async () => {
    const store = await harness();
    const result = await store
      .getState()
      .acceptReviewComments({ sessionId, threadIds: ['a', 'b', 'c', 'd', 'e'] });
    expect(result).toEqual({ acceptedCount: 3, failures: [] });
    expect(await approvalOf({ id: 'a' })).toBe('accepted');
    expect(await approvalOf({ id: 'b' })).toBe('accepted');
    expect(await approvalOf({ id: 'c' })).toBe('accepted');
    expect(await approvalOf({ id: 'd' })).toBe('none');
    expect(await approvalOf({ id: 'e' })).toBe('none');
    expect(store.getState().reviewBulkAccepts[sessionId]?.itemIds).toHaveLength(3);
  });

  it('undoes the whole bulk accept with one action', async () => {
    const store = await harness();
    await store.getState().acceptReviewComments({ sessionId, threadIds: ['a', 'b', 'c'] });
    const undone = await store.getState().undoReviewAccepts({ sessionId });
    expect(undone).toBe(true);
    for (const id of ['a', 'b', 'c']) {
      expect(await approvalOf({ id })).toBe('none');
      expect(await stageOf({ id })).toBe('proposed');
    }
    expect(store.getState().reviewBulkAccepts[sessionId]).toBeNull();
    expect(await store.getState().undoReviewAccepts({ sessionId })).toBe(false);
  });

  it('is the last operation on the app undo stack, so the undo shortcut reverts it', async () => {
    const store = await harness();
    await store.getState().acceptReviewComments({ sessionId, threadIds: ['a', 'b'] });
    expect(store.getState().undoNotices).toHaveLength(0);
    expect(await store.getState().undoLastOperation()).toBe(true);
    expect(await approvalOf({ id: 'a' })).toBe('none');
    expect(await approvalOf({ id: 'b' })).toBe('none');
  });

  it('does not offer an undo once the comments are no longer approved', async () => {
    const store = await harness();
    await store.getState().acceptReviewComments({ sessionId, threadIds: ['a'] });
    await db.execute("UPDATE resolve_threads SET stage = 'resolved' WHERE thread_id = 'a'");
    await store.getState().loadResolveSession({ sessionId });
    expect(await store.getState().undoReviewAccepts({ sessionId })).toBe(false);
    expect(await approvalOf({ id: 'a' })).toBe('accepted');
  });

  it('keeps going when one accept throws and reports which one', async () => {
    const store = await harness();
    const real = store.getState().acceptResolveQueueItem;
    store.setState({
      acceptResolveQueueItem: async (params) => {
        if (params.itemId === 'item-b') {
          throw new Error('This fix collides with one accepted before it');
        }
        return real(params);
      },
    });
    const result = await store
      .getState()
      .acceptReviewComments({ sessionId, threadIds: ['a', 'b', 'c'] });
    expect(result.acceptedCount).toBe(2);
    expect(result.failures).toEqual([
      { threadId: 'b', message: 'This fix collides with one accepted before it' },
    ]);
    expect(await approvalOf({ id: 'b' })).toBe('none');
    expect(await approvalOf({ id: 'c' })).toBe('accepted');
  });

  it('does nothing and records nothing when no comment is ready', async () => {
    const store = await harness();
    const result = await store
      .getState()
      .acceptReviewComments({ sessionId, threadIds: ['d', 'e'] });
    expect(result).toEqual({ acceptedCount: 0, failures: [] });
    expect(store.getState().reviewBulkAccepts[sessionId] ?? null).toBeNull();
    expect(store.getState().undoStack).toHaveLength(0);
  });
});
