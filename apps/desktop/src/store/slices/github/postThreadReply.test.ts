import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate, type Database } from '@goodboy/db';
import { makeTestDatabase } from '@goodboy/db/test-helpers';
import type { ResolvePublicationThread, ResolveThread, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
  exec: vi.fn(),
  transaction: vi.fn(),
  addReviewThreadReply: vi.fn(async () => ({ id: 'PRRC_9', url: 'u' })),
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: h }));
vi.mock('../../../features/github/github', () => ({ tauriGhRunner: {} }));
vi.mock('../review-source/reviewSourceFor', () => ({
  reviewSourceFor: () => ({ reply: async () => h.addReviewThreadReply() }),
}));
vi.mock('../review-source/activeReviewSource', () => ({ activeReviewSourceOf: () => null }));
vi.mock('@goodboy/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/db')>()),
  upsertResolvePublicationThread: vi.fn(async () => undefined),
}));
vi.mock('./sessionThreadGhOptions', () => ({ sessionThreadGhOptions: () => ({}) }));

import { readCommitStory } from '../resolve/commitStory';
import { postThreadReply } from './postThreadReply';
import type { GetFn } from './types';

const SESSION = 'session-ledger' as SessionId;
let db: Database;

const rowOf = ({
  disposition,
  commitShas,
}: {
  readonly disposition: ResolveThread['disposition'];
  readonly commitShas: ReadonlyArray<string>;
}): ResolveThread => ({
  id: 'row-1',
  sessionId: SESSION,
  projectId: null,
  prNumber: 318,
  threadId: 'PRRT_1',
  originKind: 'review_comment',
  diffCommentId: null,
  state: 'answered',
  stage: 'new',
  stateReason: null,
  revision: 1,
  generation: 0,
  reopenedFromThreadId: null,
  activeAttemptId: null,
  disposition,
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

const FROZEN: ResolvePublicationThread = {
  publicationId: 'publication',
  threadId: 'PRRT_1',
  revision: 1,
  priorState: 'answered',
  sourceFingerprint: null,
  operationId: 'operation',
  replyBody: 'body',
  replyPhase: 'pending',
  replyId: null,
  replyAttemptedAt: null,
  replyPostedAt: null,
  resolvePhase: 'pending',
  resolvedAt: null,
  error: null,
};

const post = ({ row }: { readonly row: ResolveThread }) =>
  postThreadReply({
    get: (() => ({
      sessionResolveThreads: { [SESSION]: [row] },
      sessionGithub: {},
      updateResolveThread: vi.fn(async () => undefined),
    })) as unknown as GetFn,
    sessionId: SESSION,
    threadId: 'PRRT_1',
    replyBody: 'Fixed in `e31b9f4`.',
    frozen: FROZEN,
  });

beforeEach(async () => {
  db = makeTestDatabase();
  h.exec.mockReset().mockImplementation(db.exec);
  h.execute.mockReset().mockImplementation(db.execute);
  h.select.mockReset().mockImplementation(db.select);
  h.transaction.mockReset().mockImplementation(db.transaction);
  await migrate(db);
});

describe('postThreadReply', () => {
  it('remembers the sha and body of a reply about a fix', async () => {
    await expect(
      post({ row: rowOf({ disposition: 'fix', commitShas: ['c81e5aa', 'e31b9f4'] }) }),
    ).resolves.toEqual({ posted: true, replyId: 'PRRC_9' });
    expect(await readCommitStory({ sessionId: SESSION, threadId: 'PRRT_1' })).toEqual({
      originalSha: null,
      isFolded: false,
      reply: { sha: 'e31b9f4', body: 'Fixed in `e31b9f4`.', lines: [] },
    });
  });

  it('remembers nothing for a reply that names no commit', async () => {
    await post({ row: rowOf({ disposition: 'no_change', commitShas: [] }) });
    expect((await readCommitStory({ sessionId: SESSION, threadId: 'PRRT_1' })).reply).toBeNull();
  });
});
