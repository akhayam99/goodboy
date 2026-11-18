// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertResolveCandidate,
  insertResolveCandidateItem,
  insertResolveQueueItem,
  listResolveCandidates,
  listResolveQueueItems,
  listResolveThreads,
  upsertResolveThread,
  type Database,
} from '@goodboy/db';
import { brandId, type ResolveQueueItem, type ResolveThread, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  type StoryStore,
} from '../../../storyHarness';
import { DISCARD_FIX_ERROR } from './discardFixError';

const sessionId = brandId<SessionId>({ value: 'session' });
const WORKTREE = '/repo/payments-api';

const thread: ResolveThread = {
  id: 'thread-row',
  sessionId,
  projectId: null,
  prNumber: 318,
  threadId: 'thread',
  originKind: 'review_comment',
  diffCommentId: null,
  state: 'fixed',
  stage: 'proposed',
  stateReason: null,
  revision: 2,
  generation: 0,
  reopenedFromThreadId: null,
  activeAttemptId: null,
  disposition: 'fix',
  replyDraft: 'Fixed in 90b1d57.',
  commitShas: ['90b1d57'],
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
let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type CandidateParams = {
  readonly id: string;
  readonly queueItemIds: ReadonlyArray<string>;
};

const stageCandidate = async ({ id, queueItemIds }: CandidateParams): Promise<void> => {
  await insertResolveCandidate({
    db,
    candidate: {
      id,
      sessionId,
      revision: 1,
      baseSha: 'base-sha',
      candidateSha: '90b1d57',
      worktreePath: WORKTREE,
      mountTarget: null,
      state: 'ready',
      integratedSha: null,
      createdAt: 1,
      updatedAt: 1,
    },
  });
  for (const queueItemId of queueItemIds) {
    await insertResolveCandidateItem({
      db,
      item: { candidateId: id, queueItemId, itemRevision: 2 },
    });
  }
};

const storedThread = async (): Promise<ResolveThread | undefined> =>
  (await listResolveThreads({ db, sessionId })).find((row) => row.threadId === 'thread');

const candidateStates = async (): Promise<ReadonlyArray<string>> =>
  (await listResolveCandidates({ db, sessionId })).map((candidate) => candidate.state);

beforeEach(async () => {
  await resetStoryStore();
  db = await openStorySqlite();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await upsertResolveThread({ db, row: thread, expectedRevision: null });
  await insertResolveQueueItem({ db, item });
  useAppStore.setState({ sessionResolveThreads: { [sessionId]: [thread] } });
});

describe('discarding the proposed fix of one comment', () => {
  it('throws the patch away and puts the comment back to open with nothing applied', async () => {
    await stageCandidate({ id: 'candidate', queueItemIds: ['item'] });

    await useAppStore.getState().discardProposedFix({
      sessionId,
      threadId: 'thread',
      worktreePath: WORKTREE,
    });

    expect(await storedThread()).toMatchObject({
      state: 'open',
      stage: 'new',
      disposition: null,
      replyDraft: null,
      commitShas: null,
    });
    expect(await candidateStates()).toEqual(['discarded']);
    const [entry] = await listResolveQueueItems({ db, sessionId });
    expect(entry?.item).toMatchObject({ approvalState: 'none', integratedSha: null });
    expect(
      useAppStore
        .getState()
        .sessionResolveThreads[sessionId]?.find((row) => row.threadId === 'thread')?.stage,
    ).toBe('new');
  });

  it('leaves everything as it was when the fix belongs to another worktree', async () => {
    await stageCandidate({ id: 'candidate', queueItemIds: ['item'] });

    await expect(
      useAppStore.getState().discardProposedFix({
        sessionId,
        threadId: 'thread',
        worktreePath: '/repo/ledger-core',
      }),
    ).rejects.toThrow(DISCARD_FIX_ERROR.otherWorktree);

    expect(await storedThread()).toMatchObject({ stage: 'proposed', commitShas: ['90b1d57'] });
    expect(await candidateStates()).toEqual(['ready']);
  });

  it('throws a shared fix away for every comment it answers at once', async () => {
    await upsertResolveThread({
      db,
      row: { ...thread, id: 'thread-row-2', threadId: 'thread-2' },
      expectedRevision: null,
    });
    await insertResolveQueueItem({ db, item: { ...item, id: 'item-2', threadId: 'thread-2' } });
    await stageCandidate({ id: 'candidate', queueItemIds: ['item', 'item-2'] });

    await useAppStore
      .getState()
      .discardProposedFix({ sessionId, threadId: 'thread', worktreePath: WORKTREE });

    const rows = await listResolveThreads({ db, sessionId });
    expect(rows.map((row) => [row.threadId, row.state, row.stage, row.commitShas])).toEqual([
      ['thread', 'open', 'new', null],
      ['thread-2', 'open', 'new', null],
    ]);
    expect(await candidateStates()).toEqual(['discarded']);
    const entries = await listResolveQueueItems({ db, sessionId });
    expect(entries.map((entry) => entry.item.candidateRevision === entry.thread.revision)).toEqual([
      true,
      true,
    ]);
    expect(
      (useAppStore.getState().sessionResolveThreads[sessionId] ?? []).map((row) => row.stage),
    ).toEqual(['new', 'new']);
  });

  it('keeps a shared fix when another comment it answers is already decided', async () => {
    await upsertResolveThread({
      db,
      row: { ...thread, id: 'thread-row-2', threadId: 'thread-2' },
      expectedRevision: null,
    });
    await insertResolveQueueItem({
      db,
      item: { ...item, id: 'item-2', threadId: 'thread-2', approvalState: 'accepted' },
    });
    await stageCandidate({ id: 'candidate', queueItemIds: ['item', 'item-2'] });

    await expect(
      useAppStore
        .getState()
        .discardProposedFix({ sessionId, threadId: 'thread', worktreePath: WORKTREE }),
    ).rejects.toThrow(DISCARD_FIX_ERROR.sharedDecided);

    expect(await candidateStates()).toEqual(['ready']);
    expect((await storedThread())?.stage).toBe('proposed');
  });

  it('refuses a fix already committed on the branch', async () => {
    await expect(
      useAppStore
        .getState()
        .discardProposedFix({ sessionId, threadId: 'thread', worktreePath: WORKTREE }),
    ).rejects.toThrow(DISCARD_FIX_ERROR.onBranch);

    expect((await storedThread())?.commitShas).toEqual(['90b1d57']);
  });

  it('does nothing a second time once the fix is gone', async () => {
    await stageCandidate({ id: 'candidate', queueItemIds: ['item'] });
    await useAppStore.getState().discardProposedFix({
      sessionId,
      threadId: 'thread',
      worktreePath: WORKTREE,
    });
    const after = await storedThread();

    await expect(
      useAppStore
        .getState()
        .discardProposedFix({ sessionId, threadId: 'thread', worktreePath: WORKTREE }),
    ).rejects.toThrow(DISCARD_FIX_ERROR.noFix);

    expect(await storedThread()).toEqual(after);
  });
});
