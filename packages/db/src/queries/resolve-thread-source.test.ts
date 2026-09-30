import { describe, expect, it } from 'vitest';
import type { ResolveThread, SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { listResolveThreads, upsertResolveThread } from './resolve-thread';
import { listResolveThreadFacts } from './resolve-thread-facts';

const SESSION = 'session' as SessionId;

const seed = async () => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Relay retries', 'idle', 1, 1)",
  );
  return db;
};

const row = (overrides: Partial<ResolveThread>): ResolveThread => ({
  id: 'thread',
  sessionId: SESSION,
  projectId: null,
  prNumber: 57,
  threadId: 'gitlab:d41',
  originKind: 'review_comment',
  diffCommentId: null,
  state: 'open',
  stage: 'new',
  stateReason: null,
  revision: 0,
  generation: 0,
  reopenedFromThreadId: null,
  activeAttemptId: null,
  disposition: null,
  replyDraft: null,
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
  ...overrides,
});

describe('resolve thread source columns', () => {
  it('stores the source kind and provider thread id a thread is created with', async () => {
    const db = await seed();
    await upsertResolveThread({
      db,
      row: row({ sourceKind: 'gitlab', providerThreadId: 'd41' }),
      expectedRevision: null,
    });
    const [listed] = await listResolveThreads({ db, sessionId: SESSION });
    expect(listed?.sourceKind).toBe('gitlab');
    expect(listed?.providerThreadId).toBe('d41');
    const [facts] = await listResolveThreadFacts({ db, sessionId: SESSION });
    expect(facts?.sourceKind).toBe('gitlab');
    expect(facts?.providerThreadId).toBe('d41');
  });

  it('defaults a review thread to github and a diff note to local', async () => {
    const db = await seed();
    await upsertResolveThread({
      db,
      row: row({ id: 'a', threadId: 'PRRT_1' }),
      expectedRevision: null,
    });
    await upsertResolveThread({
      db,
      row: row({ id: 'b', threadId: 'note:1', originKind: 'diff_comment' }),
      expectedRevision: null,
    });
    const listed = await listResolveThreads({ db, sessionId: SESSION });
    expect(listed.map((thread) => thread.sourceKind)).toEqual(['github', 'local']);
  });

  it('keeps the source when a later write updates the row', async () => {
    const db = await seed();
    await upsertResolveThread({
      db,
      row: row({ sourceKind: 'gitlab', providerThreadId: 'd41' }),
      expectedRevision: null,
    });
    await upsertResolveThread({
      db,
      row: row({ state: 'closed', sourceKind: 'github', providerThreadId: null }),
      expectedRevision: 0,
    });
    const [listed] = await listResolveThreads({ db, sessionId: SESSION });
    expect(listed?.state).toBe('closed');
    expect(listed?.sourceKind).toBe('gitlab');
    expect(listed?.providerThreadId).toBe('d41');
  });
});
