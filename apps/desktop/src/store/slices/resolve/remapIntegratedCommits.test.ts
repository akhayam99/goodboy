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
import { remapIntegratedCommits } from './remapIntegratedCommits';

const workspace = aWorkspace({ name: 'Harborline' });
const session = aSession({ workspaceId: workspace.id, goal: 'Answer the batching review' });
const WORKTREE = '/repos/ledger-core';

const row: ResolveThread = {
  id: 'row-PRRT_1',
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
  commitShas: ['4f21c8b'],
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
};

type RangeArgs = { readonly base: string; readonly head: string };

let rangeReads: RangeArgs[];

const commitShasAfter = async ({ integratedSha }: { readonly integratedSha: string }) => {
  const db = storySqlite();
  const threads = await listResolveThreads({ db, sessionId: session.id });
  await remapIntegratedCommits({
    sessionId: session.id,
    worktreePath: WORKTREE,
    baseSha: 'base',
    candidateSha: 'candidate',
    integratedSha,
    threads,
  });
  return (await listResolveThreads({ db, sessionId: session.id })).map(
    (thread) => thread.commitShas,
  );
};

beforeEach(async () => {
  resetStorySpies();
  rangeReads = [];
  stubStoryInvoke({
    worktree_commit_range: ({ base, head }: RangeArgs) => {
      rangeReads.push({ base, head });
      return head === 'candidate'
        ? [{ sha: '4f21c8bfull', subject: 'Guard empty batches' }]
        : [{ sha: '9e8d7c6full', subject: 'Guard empty batches' }];
    },
  });
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertSession(db, session);
  await upsertResolveThread({ db, row, expectedRevision: null });
});

describe('remapIntegratedCommits', () => {
  it('records the cherry-picked sha on every thread the candidate covered', async () => {
    expect(await commitShasAfter({ integratedSha: 'picked' })).toEqual([['9e8d7c6full']]);
    expect(rangeReads).toEqual([
      { base: 'base', head: 'candidate' },
      { base: 'picked~1', head: 'picked' },
    ]);
  });

  it('reads nothing after a fast-forward', async () => {
    expect(await commitShasAfter({ integratedSha: 'candidate' })).toEqual([['4f21c8b']]);
    expect(rangeReads).toEqual([]);
  });
});
