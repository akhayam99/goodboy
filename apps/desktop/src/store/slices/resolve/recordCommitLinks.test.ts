vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertSession,
  insertWorkspace,
  listResolveThreads,
  upsertResolveThread,
} from '@goodboy/db';
import type { ResolveThread } from '@goodboy/types';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import { openStorySqlite, resetStorySpies, storySqlite, stubStoryInvoke } from '../../storyHarness';
import { recordCommitLinks } from './recordCommitLinks';

const workspace = aWorkspace({ name: 'Harborline' });
const session = aSession({ workspaceId: workspace.id, goal: 'Answer the retry review' });
const WORKTREE = '/repos/payments-api';

const threadRow = (patch: Partial<ResolveThread>): ResolveThread => ({
  id: `row-${patch.threadId ?? 'PRRT_1'}`,
  sessionId: session.id,
  projectId: null,
  prNumber: 528,
  threadId: 'PRRT_1',
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
  commitShas: ['9e8d7c6'],
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
  sourceKind: 'github',
  providerThreadId: null,
  ...patch,
});

type Wire = {
  range: ReadonlyArray<{ readonly sha: string; readonly subject: string }>;
  isAncestor: boolean;
};

let wire: Wire;

const answerWith = (next: Partial<Wire>) => {
  wire = { ...wire, ...next };
};

const seed = async (rows: ReadonlyArray<ResolveThread>) => {
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertSession(db, session);
  for (const row of rows) {
    await upsertResolveThread({ db, row, expectedRevision: null });
  }
};

const capture = async () => {
  const db = storySqlite();
  const threads = await listResolveThreads({ db, sessionId: session.id });
  await recordCommitLinks({
    sessionId: session.id,
    worktreePath: WORKTREE,
    baseSha: 'base',
    candidateSha: 'tip',
    threads,
  });
  const stored = await listResolveThreads({ db, sessionId: session.id });
  return stored.map(({ threadId, fixupOfSha, replacesSha }) => ({
    threadId,
    fixupOfSha,
    replacesSha,
  }));
};

beforeEach(() => {
  resetStorySpies();
  wire = { range: [], isAncestor: false };
  stubStoryInvoke({
    worktree_commit_range: () => wire.range,
    worktree_commits: [{ sha: '3a1f9c2full', subject: 'Add retry policy' }],
    worktree_is_ancestor: () => wire.isAncestor,
  });
});

describe('recordCommitLinks', () => {
  it('records the branch commit a fixup commit points at', async () => {
    await seed([threadRow({})]);
    answerWith({ range: [{ sha: '9e8d7c6full', subject: 'fixup! Add retry policy' }] });

    expect(await capture()).toEqual([
      { threadId: 'PRRT_1', fixupOfSha: '3a1f9c2full', replacesSha: null },
    ]);
  });

  it('keeps the replaced commit when the revision amended it away', async () => {
    await seed([threadRow({ replacesSha: '4f21c8b' })]);
    answerWith({ range: [{ sha: '9e8d7c6full', subject: 'Guard empty batches' }] });

    expect(await capture()).toEqual([
      { threadId: 'PRRT_1', fixupOfSha: null, replacesSha: '4f21c8b' },
    ]);
  });

  it('drops the replaced commit when the new fix sits on top of it', async () => {
    await seed([threadRow({ replacesSha: '4f21c8b' })]);
    answerWith({
      range: [{ sha: '9e8d7c6full', subject: 'Guard empty batches' }],
      isAncestor: true,
    });

    expect(await capture()).toEqual([{ threadId: 'PRRT_1', fixupOfSha: null, replacesSha: null }]);
  });

  it('writes nothing for a normal commit or a thread without a commit', async () => {
    await seed([threadRow({}), threadRow({ threadId: 'PRRT_2', commitShas: null })]);
    answerWith({ range: [{ sha: '9e8d7c6full', subject: 'Guard empty batches' }] });

    expect(await capture()).toEqual([
      { threadId: 'PRRT_1', fixupOfSha: null, replacesSha: null },
      { threadId: 'PRRT_2', fixupOfSha: null, replacesSha: null },
    ]);
  });
});
