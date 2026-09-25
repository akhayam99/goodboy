import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import {
  insertResolveQueueItem,
  listResolveQueueItems,
  listResolveThreads,
  migrate,
  upsertResolveThread,
  type Database,
} from '@goodboy/db';
import { approvedPublicationScope } from './approvedPublicationScope';
import { saveResolveThread } from './saveResolveThread';
import { makeTestDatabase } from '@goodboy/db/test-helpers';
import type { ResolveQueueItem, ResolveThread, SessionId } from '@goodboy/types';
import { createResolveSlice } from './index';
import { EMPTY_REFUSAL_REPLY, REFUSAL_AFTER_INTEGRATION } from './refuseResolveQueueItem';
import { resolveInitialState } from './state';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
  exec: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: h }));

const sessionId = 'session' as SessionId;
const thread: ResolveThread = {
  id: 'thread-row',
  sessionId,
  projectId: null,
  prNumber: 1,
  threadId: 'thread',
  originKind: 'review_comment',
  state: 'fixed',
  stage: 'new',
  stateReason: null,
  revision: 2,
  activeAttemptId: null,
  disposition: 'reply',
  replyDraft: 'Reply',
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
};
const item: ResolveQueueItem = {
  id: 'item',
  sessionId,
  threadId: 'thread',
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
};
let db: Database;

const createHarness = () => {
  const store = createStore(() => ({
    ...resolveInitialState,
    sessionResolveThreads: { [sessionId]: [thread] },
  }));
  const set = store.setState as unknown as SetFn;
  const get = store.getState as unknown as GetFn;
  return { store, actions: createResolveSlice({ set, get }) };
};

beforeEach(async () => {
  db = makeTestDatabase();
  h.exec.mockReset().mockImplementation(db.exec);
  h.execute.mockReset().mockImplementation(db.execute);
  h.select.mockReset().mockImplementation(db.select);
  h.transaction.mockReset().mockImplementation(db.transaction);
  await migrate(db);
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await upsertResolveThread({ db, row: thread, expectedRevision: null });
  await insertResolveQueueItem({ db, item });
});

describe('resolve queue actions', () => {
  it('accepts the observed revision and fails loudly for a stale revision', async () => {
    const live = createHarness();
    await expect(
      live.actions.acceptResolveQueueItem({
        sessionId,
        itemId: item.id,
        revision: 1,
        reply: 'Old',
      }),
    ).rejects.toThrow('stale');
    await live.actions.acceptResolveQueueItem({
      sessionId,
      itemId: item.id,
      revision: 2,
      reply: 'Reply',
    });
    expect(live.store.getState().sessionResolveQueueItems[sessionId]?.[0]?.item).toMatchObject({
      approvalState: 'accepted',
      approvedRevision: 2,
    });
  });

  it('defers an item', async () => {
    const live = createHarness();
    await live.actions.deferResolveQueueItem({ sessionId, itemId: item.id });
    expect((await listResolveQueueItems({ db, sessionId }))[0]?.item.approvalState).toBe(
      'deferred',
    );
    expect((await listResolveQueueItems({ db, sessionId }))[0]?.thread.stage).toBe('parked');
  });

  it('takes up a deferred item back into review when it carries a proposal', async () => {
    const live = createHarness();
    await live.actions.deferResolveQueueItem({ sessionId, itemId: item.id });
    await live.actions.takeUpResolveQueueItem({ sessionId, itemId: item.id });
    const [entry] = await listResolveQueueItems({ db, sessionId });
    expect(entry?.item.approvalState).toBe('none');
    expect(entry?.thread.stage).toBe('proposed');
  });

  it('writes the stage without moving the revision an approval is pinned to', async () => {
    const live = createHarness();
    await live.actions.refuseResolveQueueItem({
      sessionId,
      itemId: item.id,
      revision: 2,
      reply: 'Reply',
    });
    const [entry] = await listResolveQueueItems({ db, sessionId });
    expect(entry?.thread.stage).toBe('approved');
    expect(entry?.thread.revision).toBe(entry?.item.approvedRevision);
  });

  it('refuses a comment only with a reply the reviewer can read', async () => {
    const live = createHarness();
    await expect(
      live.actions.refuseResolveQueueItem({
        sessionId,
        itemId: item.id,
        revision: 2,
        reply: '   ',
      }),
    ).rejects.toThrow(EMPTY_REFUSAL_REPLY);
    expect(EMPTY_REFUSAL_REPLY).toBe('Write the reply the reviewer will read before you refuse');
    expect((await listResolveQueueItems({ db, sessionId }))[0]?.item.approvalState).toBe('none');
    await live.actions.refuseResolveQueueItem({
      sessionId,
      itemId: item.id,
      revision: 2,
      reply: 'Reply',
    });
    expect((await listResolveQueueItems({ db, sessionId }))[0]?.item).toMatchObject({
      approvalState: 'wont_fix',
      approvedRevision: 2,
    });
    expect((await listResolveQueueItems({ db, sessionId }))[0]?.item.approvedReplyHash).not.toBe(
      null,
    );
  });

  it('refuses with the reply the maintainer rewrote, and keeps that text', async () => {
    const live = createHarness();
    await live.actions.refuseResolveQueueItem({
      sessionId,
      itemId: item.id,
      revision: 2,
      reply: 'We are keeping this as it is',
    });

    expect((await listResolveQueueItems({ db, sessionId }))[0]?.item.approvalState).toBe(
      'wont_fix',
    );
    expect((await listResolveThreads({ db, sessionId }))[0]?.replyDraft).toBe(
      'We are keeping this as it is',
    );
  });

  it('accepts with the reply the maintainer rewrote, and keeps that text', async () => {
    const live = createHarness();
    await live.actions.acceptResolveQueueItem({
      sessionId,
      itemId: item.id,
      revision: 2,
      reply: 'Rewrote the reply myself',
    });

    expect((await listResolveQueueItems({ db, sessionId }))[0]?.item.approvalState).toBe(
      'accepted',
    );
    expect((await listResolveThreads({ db, sessionId }))[0]?.replyDraft).toBe(
      'Rewrote the reply myself',
    );
  });

  it('puts the reply back when the decision it was written for is refused', async () => {
    const live = createHarness();
    const before = (await listResolveThreads({ db, sessionId }))[0]?.replyDraft ?? null;
    await db.execute('UPDATE resolve_queue_items SET delivered_at = 1 WHERE id = ?', [item.id]);

    await expect(
      live.actions.refuseResolveQueueItem({
        sessionId,
        itemId: item.id,
        revision: 2,
        reply: 'A reply that never lands',
      }),
    ).rejects.toThrow();

    expect((await listResolveThreads({ db, sessionId }))[0]?.replyDraft).toBe(before);
    expect((await listResolveQueueItems({ db, sessionId }))[0]?.item.approvalState).toBe('none');
  });

  it('will not refuse a comment whose fix is already on the branch', async () => {
    const live = createHarness();
    await db.execute("UPDATE resolve_queue_items SET integrated_sha = 'abc' WHERE id = ?", [
      item.id,
    ]);
    await expect(
      live.actions.refuseResolveQueueItem({
        sessionId,
        itemId: item.id,
        revision: 2,
        reply: 'Reply',
      }),
    ).rejects.toThrow(REFUSAL_AFTER_INTEGRATION);
    expect(REFUSAL_AFTER_INTEGRATION).toBe('Fix already integrated');
    expect((await listResolveQueueItems({ db, sessionId }))[0]?.item.approvalState).toBe('none');
  });

  it('drops a saved refusal out of publication once the comment changes', async () => {
    const live = createHarness();
    await live.actions.refuseResolveQueueItem({
      sessionId,
      itemId: item.id,
      revision: 2,
      reply: 'Reply',
    });
    expect([...(await approvedPublicationScope({ sessionId })).refusedThreadIds]).toEqual([
      'thread',
    ]);
    await saveResolveThread({
      db,
      row: { ...thread, replyDraft: 'Rewritten' },
      expectedRevision: 2,
    });
    const scope = await approvedPublicationScope({ sessionId });
    expect([...scope.refusedThreadIds]).toEqual([]);
    expect([...scope.threadIds]).toEqual([]);
    const entry = (await listResolveQueueItems({ db, sessionId }))[0];
    expect(entry?.thread.stage).toBe('proposed');
  });

  it('takes up a refused item back into undecided', async () => {
    const live = createHarness();
    await live.actions.refuseResolveQueueItem({
      sessionId,
      itemId: item.id,
      revision: 2,
      reply: 'Reply',
    });
    await live.actions.takeUpResolveQueueItem({ sessionId, itemId: item.id });
    expect((await listResolveQueueItems({ db, sessionId }))[0]?.item).toMatchObject({
      approvalState: 'none',
      approvedRevision: null,
      approvedReplyHash: null,
    });
  });

  it('reopens an item as a new generation', async () => {
    const live = createHarness();
    await live.actions.reopenResolveQueueItem({ sessionId, itemId: item.id, revision: 2 });
    expect((await listResolveQueueItems({ db, sessionId }))[0]?.item).toMatchObject({
      generation: 1,
      reopenedFromItemId: item.id,
    });
  });
});
