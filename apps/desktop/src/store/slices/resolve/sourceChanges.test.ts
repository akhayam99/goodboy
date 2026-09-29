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
import { makeTestDatabase } from '@goodboy/db/test-helpers';
import type { PrComment, ResolveQueueItem, ResolveThread, SessionId } from '@goodboy/types';
import { reviewCommentStateOf } from '../../../features/resolve/reviewCommentState';
import { buildResolveQueueRows } from '../../../features/resolve/buildResolveQueueRows';
import { createResolveSlice } from './index';
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
const THREAD = 'PRRT_timeout';

const comment = (body: string, over: Partial<PrComment> = {}): PrComment => ({
  id: 'c1',
  author: 'mquint',
  authorAvatarUrl: null,
  body,
  createdAt: '2026-09-29T10:00:00Z',
  url: 'https://example.test/pull/318#c1',
  source: 'review',
  threadId: THREAD,
  ...over,
});

const seedThread: ResolveThread = {
  id: 'row',
  sessionId,
  projectId: null,
  prNumber: 318,
  threadId: THREAD,
  originKind: 'review_comment',
  diffCommentId: null,
  state: 'fixed',
  stage: 'proposed',
  stateReason: null,
  revision: 1,
  generation: 0,
  reopenedFromThreadId: null,
  activeAttemptId: null,
  disposition: 'fix',
  replyDraft: 'Moved the timeout to config.',
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
const seedItem: ResolveQueueItem = {
  id: 'item',
  sessionId,
  threadId: THREAD,
  generation: 0,
  reopenedFromItemId: null,
  candidateRevision: 1,
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
  const store = createStore(() => ({ ...resolveInitialState, diffComments: {} }));
  const set = store.setState as unknown as SetFn;
  const get = store.getState as unknown as GetFn;
  return { get, actions: createResolveSlice({ set, get }) };
};

const stateNow = async ({ isChanged }: { readonly isChanged: boolean }) => {
  const entries = await listResolveQueueItems({ db, sessionId });
  const [row] = buildResolveQueueRows({
    entries,
    attempts: [],
    deliveryReceipts: [],
    comments: [],
  });
  if (row === undefined) {
    throw new Error('no row');
  }
  return reviewCommentStateOf({ row, isChanged });
};

beforeEach(async () => {
  db = makeTestDatabase();
  h.exec.mockReset().mockImplementation(db.exec);
  h.execute.mockReset().mockImplementation(db.execute);
  h.select.mockReset().mockImplementation(db.select);
  h.transaction.mockReset().mockImplementation(db.transaction);
  await migrate(db);
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await upsertResolveThread({ db, row: seedThread, expectedRevision: null });
  await insertResolveQueueItem({ db, item: seedItem });
});

describe('source changes', () => {
  it('does not mark a draft outdated when a plain write bumps the thread revision', async () => {
    const { actions, get } = createHarness();
    const comments = [comment('Move the timeout to config.')];
    await actions.syncSourceSnapshots({ sessionId, prNumber: 318, comments });
    await actions.updateResolveThreads({
      sessionId,
      keepsDraft: true,
      updates: [{ threadId: THREAD, revision: 1, patch: { githubResolved: false } }],
    });

    const [thread] = await listResolveThreads({ db, sessionId });
    const [entry] = await listResolveQueueItems({ db, sessionId });
    expect(thread?.revision).toBe(2);
    expect(entry?.item.candidateRevision).toBe(2);
    await actions.syncSourceSnapshots({ sessionId, prNumber: 318, comments });
    expect(get().sessionResolveSourceChanges[sessionId]).toEqual({});
    expect(await stateNow({ isChanged: false })).toBe('ready');
  });

  it('marks a real edit as a change with the text before and after and who wrote it', async () => {
    const { actions, get } = createHarness();
    await actions.syncSourceSnapshots({
      sessionId,
      prNumber: 318,
      comments: [comment('Move the timeout to config.')],
    });
    await actions.syncSourceSnapshots({
      sessionId,
      prNumber: 318,
      comments: [comment('Move the timeout to config and cap the backoff at 30 seconds.')],
    });

    const snapshot = get().sessionResolveSourceChanges[sessionId]?.[THREAD];
    expect(snapshot?.body).toBe('Move the timeout to config.');
    expect(snapshot?.changed).toMatchObject({
      body: 'Move the timeout to config and cap the backoff at 30 seconds.',
      author: 'mquint',
    });
    expect(await stateNow({ isChanged: true })).toBe('outdated');
  });

  it('keeping the draft clears the change and leaves the draft acceptable', async () => {
    const { actions, get } = createHarness();
    await actions.syncSourceSnapshots({
      sessionId,
      prNumber: 318,
      comments: [comment('Move the timeout to config.')],
    });
    const edited = [comment('Move the timeout to config and cap the backoff.')];
    await actions.syncSourceSnapshots({ sessionId, prNumber: 318, comments: edited });
    await upsertResolveThread({
      db,
      row: { ...seedThread, replyDraft: 'Edited elsewhere' },
      expectedRevision: 1,
    });

    await actions.settleResolveSourceChange({ sessionId, threadId: THREAD, keepDraft: true });

    expect(get().sessionResolveSourceChanges[sessionId]).toEqual({});
    const [entry] = await listResolveQueueItems({ db, sessionId });
    expect(entry?.item.candidateRevision).toBe(entry?.thread.revision);
    await actions.syncSourceSnapshots({ sessionId, prNumber: 318, comments: edited });
    expect(get().sessionResolveSourceChanges[sessionId]).toEqual({});
  });

  it('starting a redraft moves the baseline without touching the revision', async () => {
    const { actions, get } = createHarness();
    await actions.syncSourceSnapshots({
      sessionId,
      prNumber: 318,
      comments: [comment('Move the timeout to config.')],
    });
    await actions.syncSourceSnapshots({
      sessionId,
      prNumber: 318,
      comments: [comment('Also cap the backoff.')],
    });

    await actions.settleResolveSourceChange({ sessionId, threadId: THREAD, keepDraft: false });

    expect(get().sessionResolveSourceChanges[sessionId]).toEqual({});
    const [entry] = await listResolveQueueItems({ db, sessionId });
    expect(entry?.item.candidateRevision).toBe(1);
  });
});
