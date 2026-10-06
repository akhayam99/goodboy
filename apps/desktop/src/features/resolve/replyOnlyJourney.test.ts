// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  insertResolveCandidate,
  insertResolveCandidateItem,
  insertResolveQueueItem,
  listResolveBatches,
  listResolvePublicationThreads,
  listResolvePublicationsForSession,
  listResolveQueueItems,
  listResolveThreads,
  upsertResolveThread,
  type Database,
} from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import type {
  AgentId,
  MountId,
  PrComment,
  ProjectId,
  ResolveCandidate,
  ResolveQueueItem,
  ResolveThread,
  SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../store';
import type { AppStore } from '../../store/store';

import { EMPTY_RESOLVE_QUEUE_VIEW } from '../../store/slices/session-view/types';
import { syncSourceThreads } from '../../store/slices/review-source/syncSourceThreads';
import { runObjectAction } from '../actions/registry';
import type { ActionEnv } from '../actions/types';
import { startSteeredAttempt } from './steerAttempt';

type GhRun = (
  args: ReadonlyArray<string>,
  opts?: Readonly<Record<string, unknown>>,
) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

const h = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
  exec: vi.fn(),
  transaction: vi.fn(),
  run: vi.fn<GhRun>(),
}));

vi.mock('../../shared/lib/db', () => ({ tauriDatabase: h }));
vi.mock('../chat/turn', () => ({ listLiveRunIds: vi.fn(async () => new Set()) }));
vi.mock('../workflows/workflows', () => ({ invokeAgentList: vi.fn(async () => []) }));
vi.mock('../integrations/github/github', () => ({ tauriGhRunner: { run: h.run } }));
vi.mock('../worktree/worktree', () => {
  const lease = ({ path }: { readonly path: string }) => ({
    path,
    holder: null,
    token: null,
    runId: null,
    isGranted: false,
    hasExited: false,
    waiting: [],
  });
  return {
    worktreeStatus: vi.fn(async () => ({
      branch: 'feature/retry',
      head: 'head-sha',
      headSubject: null,
      upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
      mainDistance: { kind: 'unknown', reason: 'no-upstream' },
      workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
      upstream: null,
      inProgress: null,
    })),
    listBranchCommits: vi.fn(async () => []),
    worktreeIsAncestor: vi.fn(async () => true),
    worktreeRemoteHead: vi.fn(async () => null),
    worktreeFetchOriginBranch: vi.fn(async () => ({
      fetched: false,
      error: null,
      remoteHead: null,
    })),
    worktreeFixOnOrigin: vi.fn(async () => ({ onOrigin: false, landedAs: null })),
    worktreeLocateFix: vi.fn(async () => ({ isKnown: false, landedAs: null, pathExists: null })),
    worktreeOriginCommitsTouching: vi.fn(async () => []),
    worktreeWriterStatus: vi.fn(async ({ path }: { readonly path: string }) => lease({ path })),
    acquireWorktreeWriter: vi.fn(async ({ path, holder }: { path: string; holder: string }) => ({
      ...lease({ path }),
      holder,
      token: 'token',
      isGranted: true,
    })),
    releaseWorktreeWriter: vi.fn(async ({ path }: { readonly path: string }) => lease({ path })),
    cancelWorktreeWriter: vi.fn(async ({ path }: { readonly path: string }) => lease({ path })),
    abandonWorktreeWriter: vi.fn(async ({ path }: { readonly path: string }) => lease({ path })),
    holdsWorktreeWriter: vi.fn(() => false),
  };
});

const AGENT_ID = 'agent-steered' as AgentId;
const SESSION_ID = 'session' as SessionId;
const PROJECT_ID = 'project-1' as ProjectId;
const MOUNT_ID = 'mount-1' as MountId;
const PR_URL = 'https://github.com/harborline/payments-api/pull/318';
const VIEWER = 'noor-b';
const REPLY_THREAD = 'PRRT_reply';
const FIX_THREAD = 'PRRT_fix';
const DRAFT = 'The retry is already capped in retryPolicy.ts, so nothing needs to change here.';

const replyOk = JSON.stringify({
  data: { addPullRequestReviewThreadReply: { comment: { id: 'IC_posted', url: 'https://x' } } },
});
const resolveOk = JSON.stringify({
  data: { resolveReviewThread: { thread: { id: 'PRRT', isResolved: true } } },
});

const commentOf = ({
  id,
  threadId,
  author,
  body,
  createdAt,
}: {
  readonly id: string;
  readonly threadId: string;
  readonly author: string;
  readonly body: string;
  readonly createdAt: string;
}): PrComment => ({
  id,
  author,
  authorAvatarUrl: null,
  body,
  createdAt,
  url: `${PR_URL}#discussion_${id}`,
  source: 'review',
  path: 'src/retryPolicy.ts',
  line: 42,
  resolved: false,
  threadId,
  canResolve: true,
});

const headOf = ({ threadId }: { readonly threadId: string }): PrComment =>
  commentOf({
    id: `head-${threadId}`,
    threadId,
    author: 'mara-k',
    body: 'Should this retry forever?',
    createdAt: '2026-10-05T09:00:00.000Z',
  });

const threadOf = ({
  threadId,
  state,
  disposition,
  reply,
  shas = null,
}: {
  readonly threadId: string;
  readonly state: ResolveThread['state'];
  readonly disposition: ResolveThread['disposition'];
  readonly reply: string;
  readonly shas?: ReadonlyArray<string> | null;
}): ResolveThread => ({
  id: `row-${threadId}`,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  prNumber: 318,
  threadId,
  originKind: 'review_comment',
  diffCommentId: null,
  state,
  stage: 'proposed',
  stateReason: null,
  revision: 2,
  generation: 0,
  reopenedFromThreadId: null,
  activeAttemptId: null,
  disposition,
  replyDraft: reply,
  commitShas: shas,
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
});

const itemOf = ({ threadId }: { readonly threadId: string }): ResolveQueueItem => ({
  id: `item-${threadId}`,
  sessionId: SESSION_ID,
  threadId,
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
});

let db: Database;

const seed = async ({ rows }: { readonly rows: ReadonlyArray<ResolveThread> }): Promise<void> => {
  for (const row of rows) {
    await upsertResolveThread({ db, row, expectedRevision: null });
    await insertResolveQueueItem({ db, item: itemOf({ threadId: row.threadId }) });
  }
};

const stageCandidate = async ({
  threadId,
  state,
}: {
  readonly threadId: string;
  readonly state: ResolveCandidate['state'];
}): Promise<void> => {
  await insertResolveCandidate({
    db,
    candidate: {
      id: `candidate-${threadId}`,
      sessionId: SESSION_ID,
      revision: 1,
      baseSha: 'base-sha',
      candidateSha: 'fix-sha',
      worktreePath: '/repo/work',
      mountTarget: null,
      state,
      integratedSha: state === 'integrated' ? 'fix-sha' : null,
      createdAt: 1,
      updatedAt: 1,
    },
  });
  await insertResolveCandidateItem({
    db,
    item: {
      candidateId: `candidate-${threadId}`,
      queueItemId: `item-${threadId}`,
      itemRevision: 2,
    },
  });
};

const spawnedPrompts: Array<string> = [];
const spawnAgent = vi.fn(
  async (_sessionId: SessionId, args: { readonly initialPrompt?: string }): Promise<AgentId> => {
    spawnedPrompts.push(args.initialPrompt ?? '');
    return AGENT_ID;
  },
);

const makeStore = async ({ comments }: { readonly comments: ReadonlyArray<PrComment> }) => {
  const mount = {
    mountId: MOUNT_ID,
    sessionId: SESSION_ID,
    projectId: PROJECT_ID,
    mountName: 'repo',
    worktreePath: '/repo/work',
    lastWorktreePath: null,
    repoRoot: '/repo',
    branch: 'feature/retry',
    baseBranch: null,
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present' as const,
    revision: 1,
  };
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({
    sessionProjectMounts: { [SESSION_ID]: [mount] },
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionGithub: { [SESSION_ID]: githubOf({ comments }) },
    githubStatus: { mode: 'gh-cli', available: true, user: VIEWER },
    resolveQueueView: {
      [SESSION_ID]: {
        ...EMPTY_RESOLVE_QUEUE_VIEW,
        lastRouting: { provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'medium' },
      },
    },
    spawnAgent,
    setAgentConfig: vi.fn(async () => undefined),
    emitNotification: vi.fn(async () => undefined),
    refreshReviewSource: vi.fn(async () => undefined),
    refreshSessionPr: vi.fn(async () => undefined),
    refreshSessionPrDetail: vi.fn(async () => undefined),
  });
  await useAppStore.getState().loadResolveSession({ sessionId: SESSION_ID });
  return useAppStore;
};

const githubOf = ({ comments }: { readonly comments: ReadonlyArray<PrComment> }) => ({
  pr: {
    number: 318,
    title: 'Cap webhook retries',
    url: PR_URL,
    state: 'open' as const,
    mergeable: null,
    checks: 'success' as const,
    baseBranch: 'main',
    headBranch: 'feature/retry',
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: '2026-10-05T09:00:00.000Z',
  },
  linkedIssues: [],
  fetchedAt: null,
  failedAt: null,
  loading: false,
  error: null,
  detail: { prNumber: 318, comments, reviews: [], reviewRequests: [], checks: [] },
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
});

const envOf = ({ store }: { readonly store: typeof useAppStore }): ActionEnv => ({
  getState: store.getState,
  showToast: vi.fn(),
  copyText: vi.fn(async () => undefined),
  origin: 'button',
  anchorKey: null,
  viewing: null,
});

const runOn = ({
  store,
  threadId,
  actionId,
}: {
  readonly store: typeof useAppStore;
  readonly threadId: string;
  readonly actionId: string;
}) =>
  runObjectAction({
    target: { kind: 'reviewComment', sessionId: SESSION_ID, threadId },
    actionId,
    env: envOf({ store }),
  });

const replyCalls = (): ReadonlyArray<string> =>
  h.run.mock.calls
    .map(([args]) => args.join(' '))
    .filter((joined) => joined.includes('addPullRequestReviewThreadReply'));

const rowOf = async ({ threadId }: { readonly threadId: string }) =>
  (await listResolveThreads({ db, sessionId: SESSION_ID })).find(
    (row) => row.threadId === threadId,
  );

const itemOfThread = async ({ threadId }: { readonly threadId: string }) =>
  (await listResolveQueueItems({ db, sessionId: SESSION_ID })).find(
    (entry) => entry.thread.threadId === threadId,
  );

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  h.exec.mockReset().mockImplementation(db.exec);
  h.execute.mockReset().mockImplementation(db.execute);
  h.select.mockReset().mockImplementation(db.select);
  h.transaction.mockReset().mockImplementation(db.transaction);
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  spawnedPrompts.length = 0;
  h.run.mockReset();
  h.run.mockImplementation(async (args) => {
    const joined = args.join(' ');
    if (joined.includes('addPullRequestReviewThreadReply')) {
      return { stdout: replyOk, stderr: '', exitCode: 0 };
    }
    return { stdout: resolveOk, stderr: '', exitCode: 0 };
  });
});

const replyOnlyRow = () =>
  threadOf({ threadId: REPLY_THREAD, state: 'answered', disposition: 'no_change', reply: DRAFT });

describe('a reply-only answer on the Comments page', () => {
  it('posts the reply the moment it is approved when nothing waits to be pushed', async () => {
    await seed({ rows: [replyOnlyRow()] });
    const store = await makeStore({ comments: [headOf({ threadId: REPLY_THREAD })] });

    await runOn({ store, threadId: REPLY_THREAD, actionId: 'reviewComment.accept' });

    expect(replyCalls()).toHaveLength(1);
    expect(replyCalls()[0]).toContain('PRRT_reply');
    const row = await rowOf({ threadId: REPLY_THREAD });
    expect(row).toMatchObject({ replyId: 'IC_posted', state: 'closed' });
    expect(row?.replyPostedAt).not.toBeNull();
    expect((await itemOfThread({ threadId: REPLY_THREAD }))?.item.deliveredAt).not.toBeNull();
    const [publication] = await listResolvePublicationsForSession({ db, sessionId: SESSION_ID });
    expect(publication).toMatchObject({ requiresPush: false, phase: 'finished' });
    const receipts = await listResolvePublicationThreads({
      db,
      publicationId: publication?.id ?? '',
    });
    expect(receipts[0]).toMatchObject({ replyPhase: 'posted' });
  });

  it('keeps the reply with the push while commits wait, and posts it on Post reply now', async () => {
    await seed({
      rows: [
        replyOnlyRow(),
        threadOf({
          threadId: FIX_THREAD,
          state: 'fixed',
          disposition: 'fix',
          reply: 'Capped at 6',
          shas: ['fix-sha'],
        }),
      ],
    });
    const store = await makeStore({
      comments: [headOf({ threadId: REPLY_THREAD }), headOf({ threadId: FIX_THREAD })],
    });
    const fix = await itemOfThread({ threadId: FIX_THREAD });
    await store.getState().acceptResolveQueueItem({
      sessionId: SESSION_ID,
      itemId: fix?.item.id ?? '',
      revision: fix?.thread.revision ?? 0,
      reply: 'Capped at 6',
    });

    await runOn({ store, threadId: REPLY_THREAD, actionId: 'reviewComment.accept' });

    expect(replyCalls()).toEqual([]);
    expect((await rowOf({ threadId: REPLY_THREAD }))?.replyPostedAt).toBeNull();
    expect((await itemOfThread({ threadId: REPLY_THREAD }))?.item.approvalState).toBe('accepted');

    await runOn({ store, threadId: REPLY_THREAD, actionId: 'reviewComment.postReplyNow' });

    expect(replyCalls()).toHaveLength(1);
    expect(replyCalls()[0]).toContain('PRRT_reply');
    expect((await rowOf({ threadId: REPLY_THREAD }))?.replyId).toBe('IC_posted');
    expect((await rowOf({ threadId: FIX_THREAD }))?.replyPostedAt).toBeNull();
  });

  it('shows the failure and posts on Retry', async () => {
    await seed({ rows: [replyOnlyRow()] });
    const store = await makeStore({ comments: [headOf({ threadId: REPLY_THREAD })] });
    h.run.mockImplementation(async () => ({ stdout: '', stderr: 'GitHub is down', exitCode: 1 }));

    await expect(
      runOn({ store, threadId: REPLY_THREAD, actionId: 'reviewComment.accept' }),
    ).rejects.toThrow();
    expect((await rowOf({ threadId: REPLY_THREAD }))?.replyPostedAt).toBeNull();

    h.run.mockImplementation(async (args) => ({
      stdout: args.join(' ').includes('addPullRequestReviewThreadReply') ? replyOk : resolveOk,
      stderr: '',
      exitCode: 0,
    }));
    await runOn({ store, threadId: REPLY_THREAD, actionId: 'reviewComment.postReplyNow' });

    expect((await rowOf({ threadId: REPLY_THREAD }))?.replyId).toBe('IC_posted');
  });

  it('marks a hand-posted reply as posted on refresh and never posts it twice', async () => {
    await seed({ rows: [replyOnlyRow()] });
    const store = await makeStore({
      comments: [
        headOf({ threadId: REPLY_THREAD }),
        commentOf({
          id: 'IC_by_hand',
          threadId: REPLY_THREAD,
          author: 'Noor-B',
          body: `  ${DRAFT.replace('already capped', 'already\n capped')}\n`,
          createdAt: '2026-10-06T10:00:00.000Z',
        }),
      ],
    });

    const marked = await store.getState().reconcileHandReplies({
      sessionId: SESSION_ID,
      prNumber: 318,
      comments: store.getState().sessionGithub[SESSION_ID]?.detail?.comments ?? [],
    });

    expect(marked).toBe(1);
    await store.getState().loadResolveSession({ sessionId: SESSION_ID });
    const row = await rowOf({ threadId: REPLY_THREAD });
    expect(row).toMatchObject({ replyId: 'IC_by_hand' });
    expect(row?.replyPostedAt).toBe(new Date('2026-10-06T10:00:00.000Z').getTime());

    await runOn({ store, threadId: REPLY_THREAD, actionId: 'reviewComment.accept' });

    expect(replyCalls()).toEqual([]);
  });

  it('reconciles hand-posted replies every time the pull request refreshes', async () => {
    const comments = [headOf({ threadId: REPLY_THREAD })];
    const reconciled: Array<Parameters<AppStore['reconcileHandReplies']>[0]> = [];
    const calls: Array<string> = [];
    useAppStore.setState(useAppStore.getInitialState(), true);
    useAppStore.setState({
      updateResolveThreads: async () => {
        calls.push('threads');
      },
      materializeReviewThreads: async () => {
        calls.push('materialize');
        return 0;
      },
      reconcileHandReplies: async (params) => {
        calls.push('reconcile');
        reconciled.push(params);
        return 0;
      },
      syncSourceSnapshots: async () => {
        calls.push('snapshots');
      },
    });
    await syncSourceThreads({
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      kind: 'github',
      prNumber: 318,
      projectId: PROJECT_ID,
      comments,
    });

    expect(calls).toEqual(['threads', 'materialize', 'reconcile', 'snapshots']);
    expect(reconciled).toEqual([{ sessionId: SESSION_ID, prNumber: 318, comments }]);
  });

  it('leaves hand-posted reply reconciliation to GitHub threads', async () => {
    const calls: Array<string> = [];
    useAppStore.setState(useAppStore.getInitialState(), true);
    useAppStore.setState({
      updateResolveThreads: async () => undefined,
      materializeReviewThreads: async () => 0,
      reconcileHandReplies: async () => {
        calls.push('reconcile');
        return 0;
      },
      syncSourceSnapshots: async () => undefined,
    });
    await syncSourceThreads({
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      kind: 'gitlab',
      prNumber: 318,
      projectId: PROJECT_ID,
      comments: [headOf({ threadId: REPLY_THREAD })],
    });

    expect(calls).toEqual([]);
  });

  it('does not take a reply from someone else, or with other words, for its own', async () => {
    await seed({ rows: [replyOnlyRow()] });
    const store = await makeStore({
      comments: [
        headOf({ threadId: REPLY_THREAD }),
        commentOf({
          id: 'IC_other_person',
          threadId: REPLY_THREAD,
          author: 'mara-k',
          body: DRAFT,
          createdAt: '2026-10-06T10:00:00.000Z',
        }),
        commentOf({
          id: 'IC_other_words',
          threadId: REPLY_THREAD,
          author: VIEWER,
          body: 'Good point, fixing it.',
          createdAt: '2026-10-06T10:05:00.000Z',
        }),
      ],
    });

    const marked = await store.getState().reconcileHandReplies({
      sessionId: SESSION_ID,
      prNumber: 318,
      comments: store.getState().sessionGithub[SESSION_ID]?.detail?.comments ?? [],
    });

    expect(marked).toBe(0);
    expect((await rowOf({ threadId: REPLY_THREAD }))?.replyPostedAt).toBeNull();
  });
});

describe('steering an answer from the thread', () => {
  it('Rewrite reply relaunches a reply-only attempt carrying the hint', async () => {
    await seed({ rows: [replyOnlyRow()] });
    const store = await makeStore({ comments: [headOf({ threadId: REPLY_THREAD })] });
    await store.getState().acceptResolveQueueItem({
      sessionId: SESSION_ID,
      itemId: `item-${REPLY_THREAD}`,
      revision: 2,
      reply: DRAFT,
    });

    await startSteeredAttempt({
      getState: store.getState,
      sessionId: SESSION_ID,
      threadId: REPLY_THREAD,
      mode: 'rewrite',
      hint: 'Mention the cap of 6 and link the commit',
    });

    expect(spawnedPrompts).toHaveLength(1);
    expect(spawnedPrompts[0]).toContain('Reply only. Change no code and make no commit.');
    expect(spawnedPrompts[0]).toContain('Mention the cap of 6 and link the commit');
    const [batch] = await listResolveBatches({ db, sessionId: SESSION_ID });
    expect(batch?.threadIds).toEqual([REPLY_THREAD]);
    expect(batch?.launchChoice.hint).toContain('Mention the cap of 6 and link the commit');
    expect((await itemOfThread({ threadId: REPLY_THREAD }))?.item.approvalState).toBe('none');
  });

  it('Fix it anyway launches a fix attempt for the thread, with an optional hint', async () => {
    await seed({ rows: [replyOnlyRow()] });
    const store = await makeStore({ comments: [headOf({ threadId: REPLY_THREAD })] });

    await startSteeredAttempt({
      getState: store.getState,
      sessionId: SESSION_ID,
      threadId: REPLY_THREAD,
      mode: 'fixAnyway',
      hint: '',
    });

    expect(spawnedPrompts[0]).toContain('wants a code change for this comment');
    const [batch] = await listResolveBatches({ db, sessionId: SESSION_ID });
    expect(batch?.launchChoice.hint).toContain('wants a code change for this comment');
    expect(batch?.launchChoice.hint).not.toContain('The owner adds');
  });

  it('Reply only refuses a fix that is already on the branch and keeps the thread as it was', async () => {
    await seed({
      rows: [
        threadOf({
          threadId: FIX_THREAD,
          state: 'fixed',
          disposition: 'fix',
          reply: 'Capped at 6',
          shas: ['fix-sha'],
        }),
      ],
    });
    await stageCandidate({ threadId: FIX_THREAD, state: 'integrated' });
    const store = await makeStore({ comments: [headOf({ threadId: FIX_THREAD })] });

    await expect(
      store.getState().switchToReplyOnly({ sessionId: SESSION_ID, threadId: FIX_THREAD }),
    ).rejects.toThrow('already on the branch');

    expect(await rowOf({ threadId: FIX_THREAD })).toMatchObject({
      disposition: 'fix',
      commitShas: ['fix-sha'],
    });
  });

  it('Reply only drops the staged change for the thread', async () => {
    await seed({
      rows: [
        threadOf({
          threadId: FIX_THREAD,
          state: 'fixed',
          disposition: 'fix',
          reply: 'Capped at 6',
          shas: ['fix-sha'],
        }),
      ],
    });
    await stageCandidate({ threadId: FIX_THREAD, state: 'ready' });
    const store = await makeStore({ comments: [headOf({ threadId: FIX_THREAD })] });

    await runOn({ store, threadId: FIX_THREAD, actionId: 'reviewComment.replyOnly' });

    expect(await rowOf({ threadId: FIX_THREAD })).toMatchObject({
      state: 'answered',
      disposition: 'no_change',
      commitShas: null,
      replyDraft: 'Capped at 6',
    });
    expect((await itemOfThread({ threadId: FIX_THREAD }))?.item.approvalState).toBe('none');
  });
});
