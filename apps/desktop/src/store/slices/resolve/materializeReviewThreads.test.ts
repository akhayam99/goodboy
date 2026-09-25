import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import {
  listResolveQueueItems,
  listResolveThreads,
  migrate,
  upsertResolveThread,
  type Database,
} from '@goodboy/db';
import { makeTestDatabase } from '@goodboy/db/test-helpers';
import type { PrComment, ProjectId, ResolveThread, SessionId } from '@goodboy/types';
import { createResolveThread } from './createResolveThread';
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
const projectId = 'project' as ProjectId;
const PR_NUMBER = 248;
let db: Database;

const reviewComment = (patch: Partial<PrComment>): PrComment => ({
  id: `review-${patch.threadId ?? 'x'}`,
  author: 'reviewer',
  authorAvatarUrl: null,
  body: 'This retries forever on a 429.',
  createdAt: '2026-01-01T10:00:00Z',
  url: 'https://github.com/acme/web/pull/248#discussion_r1',
  source: 'review',
  path: 'src/retry.ts',
  line: 12,
  resolved: false,
  outdated: false,
  ...patch,
});

const createHarness = () => {
  const store = createStore(() => ({ ...resolveInitialState }));
  const set = store.setState as unknown as SetFn;
  const get = store.getState as unknown as GetFn;
  return { store, get, actions: createResolveSlice({ set, get }) };
};

const seedRow = async (patch: Partial<ResolveThread>): Promise<void> => {
  const row = {
    ...createResolveThread({ sessionId, threadId: 'PRRT_seed', projectId, prNumber: PR_NUMBER }),
    ...patch,
  };
  await upsertResolveThread({ db, row, expectedRevision: null });
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
});

describe('materializeReviewThreads', () => {
  it('lists every open thread GitHub returned, outdated ones included', async () => {
    const { actions, get } = createHarness();
    const comments = [
      reviewComment({ threadId: 'PRRT_1' }),
      reviewComment({
        id: 'review-reply',
        threadId: 'PRRT_1',
        inReplyToId: 'review-PRRT_1',
        createdAt: '2026-01-01T11:00:00Z',
      }),
      reviewComment({ threadId: 'PRRT_2', outdated: true }),
      reviewComment({ threadId: 'PRRT_3', resolved: true }),
      { ...reviewComment({}), id: 'issue-1', source: 'issue' as const, threadId: undefined },
    ];

    const created = await actions.materializeReviewThreads({
      sessionId,
      prNumber: PR_NUMBER,
      projectId,
      comments,
    });

    expect(created).toBe(2);
    const rows = await listResolveThreads({ db, sessionId });
    expect(rows.map((row) => row.threadId).sort()).toEqual(['PRRT_1', 'PRRT_2']);
    expect(rows.every((row) => row.state === 'open' && row.prNumber === PR_NUMBER)).toBe(true);
    const items = await listResolveQueueItems({ db, sessionId });
    expect(items.map((entry) => entry.item.threadId).sort()).toEqual(['PRRT_1', 'PRRT_2']);
    expect(get().sessionResolveQueueItems[sessionId]).toHaveLength(2);
  });

  it('adds nothing the second time the same threads are read', async () => {
    const { actions } = createHarness();
    const comments = [reviewComment({ threadId: 'PRRT_1' }), reviewComment({ threadId: 'PRRT_2' })];

    await actions.materializeReviewThreads({ sessionId, prNumber: PR_NUMBER, projectId, comments });
    const again = await actions.materializeReviewThreads({
      sessionId,
      prNumber: PR_NUMBER,
      projectId,
      comments,
    });

    expect(again).toBe(0);
    expect(await listResolveThreads({ db, sessionId })).toHaveLength(2);
    expect(await listResolveQueueItems({ db, sessionId })).toHaveLength(2);
  });

  it('queues a thread an agent already touched without rewriting its record', async () => {
    const { actions } = createHarness();
    await seedRow({ threadId: 'PRRT_1', state: 'fixed', replyDraft: 'Fixed' });

    await actions.materializeReviewThreads({
      sessionId,
      prNumber: PR_NUMBER,
      projectId,
      comments: [reviewComment({ threadId: 'PRRT_1' })],
    });

    const rows = await listResolveThreads({ db, sessionId });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ state: 'fixed', replyDraft: 'Fixed' });
    expect(await listResolveQueueItems({ db, sessionId })).toHaveLength(1);
  });

  it('leaves out threads Goodboy closed and threads of another pull request', async () => {
    const { actions } = createHarness();
    await seedRow({ threadId: 'PRRT_1', state: 'closed', closedSource: 'goodboy' });
    await seedRow({ id: 'other-row', threadId: 'PRRT_2', prNumber: 7 });

    const created = await actions.materializeReviewThreads({
      sessionId,
      prNumber: PR_NUMBER,
      projectId,
      comments: [reviewComment({ threadId: 'PRRT_1' }), reviewComment({ threadId: 'PRRT_2' })],
    });

    expect(created).toBe(0);
    expect(await listResolveQueueItems({ db, sessionId })).toEqual([]);
  });
});
