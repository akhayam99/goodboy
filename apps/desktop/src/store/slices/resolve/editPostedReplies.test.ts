import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate, setSetting, type Database } from '@goodboy/db';
import { makeTestDatabase } from '@goodboy/db/test-helpers';
import type { ResolveThread, SessionId, WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
  exec: vi.fn(),
  transaction: vi.fn(),
  updateReviewComment: vi.fn(async () => ({ id: 'PRRC_1', url: 'u' })),
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: h }));
vi.mock('../../../features/github/github', () => ({ tauriGhRunner: {} }));
vi.mock('@goodboy/core', () => ({ updateReviewComment: h.updateReviewComment }));

import { editPostedReplyKey } from '../../../features/resolve/editPostedReplySetting';
import { editPostedReplies } from './editPostedReplies';
import { readCommitStory, recordCommitMove, recordPostedReply } from './commitStory';
import type { GetFn } from './types';

const SESSION = 'session-ledger' as SessionId;
const WORKSPACE = 'workspace-harborline' as WorkspaceId;
const PR_URL = 'https://github.com/acme/payments-api/pull/318';
const SIGNED = '*Written by Goodboy*';
const POSTED = `Stopped the retry loop.\n\nFixed in [\`c81e5aa\`](https://github.com/acme/payments-api/commit/c81e5aa).\n\n${SIGNED}`;

let db: Database;

const threadOf = ({
  commitShas,
  replyId = 'PRRC_1',
}: {
  readonly commitShas: ReadonlyArray<string>;
  readonly replyId?: string | null;
}): ResolveThread => ({
  id: 'row-1',
  sessionId: SESSION,
  projectId: null,
  prNumber: 318,
  threadId: 'PRRT_1',
  originKind: 'review_comment',
  diffCommentId: null,
  state: 'fixed',
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
  replyPostedAt: replyId === null ? null : 10,
  replyId,
  githubResolved: true,
  closedAt: null,
  closedSource: null,
  createdAt: 1,
  updatedAt: 1,
});

const getWith = ({ thread }: { readonly thread: ResolveThread }) =>
  (() => ({
    sessions: [{ id: SESSION, workspaceId: WORKSPACE }],
    sessionResolveThreads: { [SESSION]: [thread] },
    sessionGithub: { [SESSION]: { pr: { number: 318, url: PR_URL } } },
    sessionProjectMounts: {},
    projects: [],
  })) as unknown as GetFn;

const postThenRewrite = async ({ isFolded }: { readonly isFolded: boolean }) => {
  await recordPostedReply({ sessionId: SESSION, threadId: 'PRRT_1', sha: 'c81e5aa', body: POSTED });
  await recordCommitMove({ sessionId: SESSION, threadId: 'PRRT_1', fromSha: 'c81e5aa', isFolded });
};

beforeEach(async () => {
  db = makeTestDatabase();
  h.exec.mockReset().mockImplementation(db.exec);
  h.execute.mockReset().mockImplementation(db.execute);
  h.select.mockReset().mockImplementation(db.select);
  h.transaction.mockReset().mockImplementation(db.transaction);
  h.updateReviewComment.mockClear();
  await migrate(db);
});

describe('editPostedReplies', () => {
  it('appends the update above the signature, once per rewrite', async () => {
    await postThenRewrite({ isFolded: true });
    const get = getWith({ thread: threadOf({ commitShas: ['e31b9f4'] }) });
    await expect(editPostedReplies({ get, sessionId: SESSION })).resolves.toBe(1);
    expect(h.updateReviewComment).toHaveBeenCalledTimes(1);
    expect(h.updateReviewComment).toHaveBeenCalledWith(
      expect.anything(),
      'PRRC_1',
      'Stopped the retry loop.\n\nFixed in [`c81e5aa`](https://github.com/acme/payments-api/commit/c81e5aa).\n\nUpdate: [`c81e5aa`](https://github.com/acme/payments-api/commit/c81e5aa) was squashed into [`e31b9f4`](https://github.com/acme/payments-api/commit/e31b9f4).\n\n*Written by Goodboy*',
      expect.anything(),
    );
    await expect(editPostedReplies({ get, sessionId: SESSION })).resolves.toBe(0);
    expect(h.updateReviewComment).toHaveBeenCalledTimes(1);
  });

  it('says the sha is now another one when the rewrite did not fold it', async () => {
    await postThenRewrite({ isFolded: false });
    await editPostedReplies({
      get: getWith({ thread: threadOf({ commitShas: ['b77a301'] }) }),
      sessionId: SESSION,
    });
    const calls = h.updateReviewComment.mock.calls as unknown as ReadonlyArray<
      ReadonlyArray<string>
    >;
    expect(calls[0]?.[2]).toContain('is now');
    expect(calls[0]?.[2]).not.toContain('was squashed');
  });

  it('keeps earlier update lines when the sha moves again', async () => {
    await postThenRewrite({ isFolded: true });
    await editPostedReplies({
      get: getWith({ thread: threadOf({ commitShas: ['e31b9f4'] }) }),
      sessionId: SESSION,
    });
    await recordCommitMove({
      sessionId: SESSION,
      threadId: 'PRRT_1',
      fromSha: 'e31b9f4',
      isFolded: false,
    });
    await editPostedReplies({
      get: getWith({ thread: threadOf({ commitShas: ['b77a301'] }) }),
      sessionId: SESSION,
    });
    const calls = h.updateReviewComment.mock.calls as unknown as ReadonlyArray<
      ReadonlyArray<string>
    >;
    expect(calls).toHaveLength(2);
    expect(calls[1]?.[2]).toContain('was squashed into');
    expect(calls[1]?.[2]).toContain('is now');
    expect(calls[1]?.[2]?.endsWith(SIGNED)).toBe(true);
    expect((await readCommitStory({ sessionId: SESSION, threadId: 'PRRT_1' })).reply?.sha).toBe(
      'b77a301',
    );
  });

  it('edits nothing when the setting is off', async () => {
    await postThenRewrite({ isFolded: true });
    await setSetting(db, editPostedReplyKey({ workspaceId: WORKSPACE }), '0');
    await expect(
      editPostedReplies({
        get: getWith({ thread: threadOf({ commitShas: ['e31b9f4'] }) }),
        sessionId: SESSION,
      }),
    ).resolves.toBe(0);
    expect(h.updateReviewComment).not.toHaveBeenCalled();
  });

  it('never touches a reply Goodboy did not post', async () => {
    await expect(
      editPostedReplies({
        get: getWith({ thread: threadOf({ commitShas: ['e31b9f4'], replyId: null }) }),
        sessionId: SESSION,
      }),
    ).resolves.toBe(0);
    await recordCommitMove({
      sessionId: SESSION,
      threadId: 'PRRT_1',
      fromSha: 'c81e5aa',
      isFolded: true,
    });
    await expect(
      editPostedReplies({
        get: getWith({ thread: threadOf({ commitShas: ['e31b9f4'] }) }),
        sessionId: SESSION,
      }),
    ).resolves.toBe(0);
    expect(h.updateReviewComment).not.toHaveBeenCalled();
  });

  it('retries on the next push when GitHub refuses the edit', async () => {
    await postThenRewrite({ isFolded: true });
    h.updateReviewComment.mockRejectedValueOnce(new Error('rate limited'));
    const get = getWith({ thread: threadOf({ commitShas: ['e31b9f4'] }) });
    await expect(editPostedReplies({ get, sessionId: SESSION })).resolves.toBe(0);
    await expect(editPostedReplies({ get, sessionId: SESSION })).resolves.toBe(1);
  });
});
