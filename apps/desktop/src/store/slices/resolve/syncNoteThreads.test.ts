// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import {
  deleteDiffComment,
  insertDiffComment,
  listDiffCommentsForSession,
  listResolveQueueItems,
  listResolveThreads,
  migrate,
  reopenDiffComment,
  resolveDiffComment,
  type Database,
} from '@goodboy/db';
import { makeTestDatabase } from '@goodboy/db/test-helpers';
import type { SessionId } from '@goodboy/types';
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
let db: Database;

const createHarness = () => {
  const store = createStore(() => ({
    ...resolveInitialState,
    diffComments: {},
    sessionActiveProject: {},
  }));
  const set = store.setState as unknown as SetFn;
  const get = store.getState as unknown as GetFn;
  return { store, get, actions: createResolveSlice({ set, get }) };
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
});

describe('syncNoteThreads', () => {
  it('opens one conversation per note, with no pull request, and lists it in Review', async () => {
    const { actions, get } = createHarness();
    await insertDiffComment(db, 'rounding', sessionId, 'src/ledger.ts', 'Round half even', {
      side: 'new',
      lineNumber: 42,
    });
    await insertDiffComment(db, 'rates', sessionId, 'src/fx.ts', 'Cache the rate');

    expect(await actions.syncNoteThreads({ sessionId })).toBe(2);
    expect(await actions.syncNoteThreads({ sessionId })).toBe(0);

    const rows = await listResolveThreads({ db, sessionId });
    expect(
      rows.map((row) => [row.threadId, row.prNumber, row.originKind, row.diffCommentId]),
    ).toEqual(
      expect.arrayContaining([
        ['note:rounding', null, 'diff_comment', 'rounding'],
        ['note:rates', null, 'diff_comment', 'rates'],
      ]),
    );
    expect(
      get()
        .sessionResolveQueueItems[sessionId]?.map((entry) => entry.item.threadId)
        .sort(),
    ).toEqual(['note:rates', 'note:rounding']);
  });

  it('closes the conversation of a note that was deleted', async () => {
    const { actions } = createHarness();
    await insertDiffComment(db, 'rounding', sessionId, 'src/ledger.ts', 'Round half even');
    await actions.syncNoteThreads({ sessionId });

    await deleteDiffComment(db, 'rounding');
    await actions.syncNoteThreads({ sessionId });

    const [row] = await listResolveThreads({ db, sessionId });
    expect(row?.state).toBe('closed');
    expect(row?.stage).toBe('resolved');
  });

  it('reopening a resolved note opens a new generation instead of reviving the closed one', async () => {
    const { actions, get } = createHarness();
    await insertDiffComment(db, 'rounding', sessionId, 'src/ledger.ts', 'Round half even');
    await actions.syncNoteThreads({ sessionId });

    await resolveDiffComment(db, 'rounding');
    await actions.syncNoteThreads({ sessionId });

    await reopenDiffComment(db, 'rounding');
    await actions.syncNoteThreads({ sessionId });

    const rows = await listResolveThreads({ db, sessionId });
    const closed = rows.find((row) => row.threadId === 'note:rounding');
    const reopened = rows.find((row) => row.threadId === 'note:rounding:g1');
    expect(closed).toEqual(
      expect.objectContaining({ state: 'closed', stage: 'resolved', generation: 0 }),
    );
    expect(closed?.closedAt).not.toBeNull();
    expect(reopened).toEqual(
      expect.objectContaining({
        state: 'open',
        stage: 'new',
        generation: 1,
        reopenedFromThreadId: closed?.id,
      }),
    );
    expect(
      get()
        .sessionResolveQueueItems[sessionId]?.map((entry) => entry.item.threadId)
        .sort(),
    ).toEqual(['note:rounding', 'note:rounding:g1']);
  });
});

describe('closeResolvedNote', () => {
  it('closes the note and its conversation without anything to publish', async () => {
    const { actions, get } = createHarness();
    await insertDiffComment(db, 'rounding', sessionId, 'src/ledger.ts', 'Round half even');
    await actions.syncNoteThreads({ sessionId });

    await actions.closeResolvedNote({ sessionId, threadId: 'note:rounding' });

    const [note] = await listDiffCommentsForSession(db, sessionId);
    expect(note?.status).toBe('resolved');
    const [row] = await listResolveThreads({ db, sessionId });
    expect(row).toEqual(
      expect.objectContaining({ state: 'closed', stage: 'resolved', closedSource: 'goodboy' }),
    );
    expect(get().diffComments[sessionId]?.[0]?.status).toBe('resolved');
    expect((await listResolveQueueItems({ db, sessionId })).length).toBe(1);
  });
});
