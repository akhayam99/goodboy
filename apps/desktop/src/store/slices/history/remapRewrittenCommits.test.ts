import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import type { HistoryShaMove, ResolveThread, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
  exec: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: h }));

import { useAppStore } from '../../store';
import { readCommitStory } from '../resolve/commitStory';
import { remapRewrittenCommits } from './remapRewrittenCommits';
import type { GetFn, SetFn } from './types';

const SESSION = 'session-ledger' as SessionId;

const threadOf = ({
  threadId,
  commitShas,
}: {
  readonly threadId: string;
  readonly commitShas: ReadonlyArray<string>;
}): ResolveThread => ({
  id: `row-${threadId}`,
  sessionId: SESSION,
  projectId: null,
  prNumber: 318,
  threadId,
  originKind: 'review_comment',
  diffCommentId: null,
  state: 'answered',
  stage: 'new',
  stateReason: null,
  revision: 1,
  generation: 0,
  reopenedFromThreadId: null,
  activeAttemptId: null,
  disposition: 'fix',
  replyDraft: null,
  commitShas,
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
});

let db: Database;

const run = async ({
  threads,
  map,
}: {
  readonly threads: ReadonlyArray<ResolveThread>;
  readonly map: ReadonlyArray<HistoryShaMove>;
}) => {
  const updateResolveThread = vi.fn(async () => true);
  const get: GetFn = () => ({
    ...useAppStore.getInitialState(),
    sessionResolveThreads: { [SESSION]: threads },
    updateResolveThread,
  });
  const set: SetFn = vi.fn();
  await remapRewrittenCommits({ set, get, sessionId: SESSION, map });
  return updateResolveThread;
};

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  h.exec.mockReset().mockImplementation(db.exec);
  h.execute.mockReset().mockImplementation(db.execute);
  h.select.mockReset().mockImplementation(db.select);
  h.transaction.mockReset().mockImplementation(db.transaction);
});

describe('remapRewrittenCommits commit story', () => {
  it('remembers the sha a thread started from and that a fold moved it', async () => {
    const update = await run({
      threads: [
        threadOf({ threadId: 'PRRT_survivor', commitShas: ['7be41d0'] }),
        threadOf({ threadId: 'PRRT_folded', commitShas: ['c81e5aa'] }),
        threadOf({ threadId: 'PRRT_kept', commitShas: ['d4e7b20'] }),
      ],
      map: [
        { from: '7be41d0', to: 'e31b9f4' },
        { from: 'c81e5aa', to: 'e31b9f4' },
        { from: 'd4e7b20', to: 'a90c112' },
      ],
    });
    expect(update).toHaveBeenCalledTimes(3);
    expect(await readCommitStory({ sessionId: SESSION, threadId: 'PRRT_folded' })).toEqual({
      originalSha: 'c81e5aa',
      isFolded: true,
      reply: null,
    });
    expect(await readCommitStory({ sessionId: SESSION, threadId: 'PRRT_survivor' })).toMatchObject({
      originalSha: '7be41d0',
      isFolded: false,
    });
    expect(await readCommitStory({ sessionId: SESSION, threadId: 'PRRT_kept' })).toMatchObject({
      originalSha: 'd4e7b20',
      isFolded: false,
    });
  });

  it('keeps the first sha and the fold across two rewrites', async () => {
    await run({
      threads: [threadOf({ threadId: 'PRRT_1', commitShas: ['c81e5aa'] })],
      map: [
        { from: '7be41d0', to: 'e31b9f4' },
        { from: 'c81e5aa', to: 'e31b9f4' },
      ],
    });
    await run({
      threads: [threadOf({ threadId: 'PRRT_1', commitShas: ['e31b9f4'] })],
      map: [{ from: 'e31b9f4', to: 'b77a301' }],
    });
    expect(await readCommitStory({ sessionId: SESSION, threadId: 'PRRT_1' })).toEqual({
      originalSha: 'c81e5aa',
      isFolded: true,
      reply: null,
    });
  });

  it('writes nothing when the sha of the thread did not move', async () => {
    await run({
      threads: [threadOf({ threadId: 'PRRT_1', commitShas: ['c81e5aa'] })],
      map: [{ from: 'c81e5aa', to: 'c81e5aa' }],
    });
    expect(await readCommitStory({ sessionId: SESSION, threadId: 'PRRT_1' })).toEqual({
      originalSha: null,
      isFolded: false,
      reply: null,
    });
  });
});
