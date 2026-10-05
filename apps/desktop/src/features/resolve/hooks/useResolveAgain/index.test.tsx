// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type {
  AgentId,
  PrComment,
  PullRequestState,
  ResolveAttempt,
  SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectKindRouting } from '../../../../store/slices/agents/selectKindRouting';
import {
  EMPTY_RESOLVE_QUEUE_VIEW,
  type ResolveQueueView,
} from '../../../../store/slices/session-view/types';
import type { SessionGithubState } from '../../../../store/types';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';
import type { startResolve as StartResolve } from '../../startResolve';
import { useResolveAgain } from './index';

const { startResolve } = vi.hoisted(() => ({
  startResolve: vi.fn<typeof StartResolve>(async () => []),
}));

vi.mock('../../startResolve', () => ({ startResolve }));

const SESSION_ID = 'session-retry' as SessionId;
const PR: PullRequestState = {
  number: 248,
  title: 'Retry deliveries with a dedupe lock',
  url: 'https://github.com/acme/notify-relay/pull/248',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'feature/retry',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-01-05T09:00:00.000Z',
};

const REVIEW_COMMENT: PrComment = {
  id: 'c1',
  author: 'harbor-reviewer',
  authorAvatarUrl: null,
  body: 'Two deliveries race past the dedupe check.',
  createdAt: '2026-01-05T09:00:00.000Z',
  url: 'https://github.com/acme/notify-relay/pull/248#discussion_1',
  source: 'review',
  resolved: false,
  path: 'src/idempotency.ts',
  line: 55,
  threadId: 'PRRT_1',
};

const GITHUB_STATE: SessionGithubState = {
  pr: PR,
  linkedIssues: [],
  fetchedAt: null,
  failedAt: null,
  loading: false,
  error: null,
  detail: {
    prNumber: PR.number,
    comments: [REVIEW_COMMENT],
    reviews: [],
    reviewRequests: [],
    checks: [],
  },
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
};

const ROW: ResolveQueueRow = {
  thread: {
    id: 'thread-row-1',
    sessionId: SESSION_ID,
    projectId: null,
    prNumber: PR.number,
    threadId: 'PRRT_1',
    originKind: 'review_comment',
    diffCommentId: null,
    state: 'open',
    stage: 'proposed',
    stateReason: null,
    revision: 1,
    generation: 1,
    reopenedFromThreadId: null,
    activeAttemptId: null,
    disposition: null,
    replyDraft: 'Tried a lock',
    commitShas: ['aa11bb22'],
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
  },
  item: {
    id: 'item-row-1',
    sessionId: SESSION_ID,
    threadId: 'PRRT_1',
    generation: 1,
    reopenedFromItemId: null,
    candidateRevision: 1,
    approvalState: 'none',
    approvedRevision: null,
    approvedReplyHash: null,
    integratedSha: null,
    deferredAt: null,
    deliveredAt: null,
    supersededAt: null,
    createdAt: 1,
    updatedAt: 1,
  },
  commentThread: null,
  status: 'ready',
  rowState: {
    state: 'ready',
    node: 'ready',
    sentence: null,
    action: null,
    failedStep: null,
    isRemoteMoved: false,
  },
  attempt: null,
  reviewerNote: null,
  proposal: null,
  proposalKind: 'fix',
  coveredThreadIds: [],
  delivery: null,
};

const PICKED = { provider: 'anthropic', model: 'claude-opus-5', effort: 'high' } as const;

const LAUNCHED_ON_CODEX: ResolveAttempt = {
  id: 'attempt-1',
  sessionId: SESSION_ID,
  agentId: 'agent-attempt-1' as AgentId,
  prNumber: PR.number,
  threadIds: ['PRRT_1'],
  provider: 'codex',
  model: 'gpt-5.5',
  effort: 'medium',
  instructions: null,
  phase: 'failed',
  mountTarget: null,
  startedAt: null,
  endedAt: null,
  error: null,
  createdAt: 1,
  batchId: 'batch-1',
  copyPath: null,
  launchChoice: {
    provider: 'codex',
    model: 'gpt-5.5',
    effort: 'medium',
    commitStyle: 'fixup',
    hint: 'Keep the public API',
  },
};

const QUEUE_VIEW: ResolveQueueView = { ...EMPTY_RESOLVE_QUEUE_VIEW, lastRouting: PICKED };

beforeEach(() => {
  startResolve.mockClear();
  useAppStore.setState({
    sessions: [],
    projects: [],
    workspaceOverrides: {},
    sessionActiveProject: {},
    sessionGithub: { [SESSION_ID]: GITHUB_STATE },
    resolveQueueView: { [SESSION_ID]: QUEUE_VIEW },
  });
});

afterEach(() => {
  cleanup();
});

describe('useResolveAgain', () => {
  it('retries on the model picked for the session with the settings commit style', async () => {
    const { result } = renderHook(() => useResolveAgain({ sessionId: SESSION_ID, rows: [ROW] }));

    let outcome = '';
    await act(async () => {
      outcome = await result.current({ threadId: 'PRRT_1', instruction: 'Use ON CONFLICT' });
    });

    expect(outcome).toBe('started');
    const [params] = startResolve.mock.calls[0] ?? [];
    expect(params).toMatchObject({
      routing: PICKED,
      note: 'Use ON CONFLICT',
      mode: 'retry',
      style: { commitStyle: 'new' },
      priorContext: [{ threadId: 'PRRT_1', reply: 'Tried a lock', intent: 'retry' }],
    });
  });

  it('retries on the model picked now, not on the model of the previous launch', async () => {
    useAppStore.setState({ sessionResolveAttempts: { [SESSION_ID]: [LAUNCHED_ON_CODEX] } });
    const { result } = renderHook(() => useResolveAgain({ sessionId: SESSION_ID, rows: [ROW] }));

    await act(async () => {
      await result.current({ threadId: 'PRRT_1', instruction: '' });
    });

    const [params] = startResolve.mock.calls[0] ?? [];
    expect(params?.routing).toEqual(PICKED);
    expect(params?.batch).toEqual({
      batchId: 'batch-1',
      launchChoice: {
        provider: 'anthropic',
        model: 'claude-opus-5',
        effort: 'high',
        commitStyle: 'fixup',
        hint: 'Keep the public API',
      },
    });
  });

  it('retries on the resolver default when nothing was picked, whatever ran before', async () => {
    useAppStore.setState({
      resolveQueueView: {},
      sessionResolveAttempts: { [SESSION_ID]: [LAUNCHED_ON_CODEX] },
    });
    const { result } = renderHook(() => useResolveAgain({ sessionId: SESSION_ID, rows: [ROW] }));

    await act(async () => {
      await result.current({ threadId: 'PRRT_1', instruction: '' });
    });

    const [params] = startResolve.mock.calls[0] ?? [];
    const roleDefault = selectKindRouting({
      state: useAppStore.getState(),
      sessionId: SESSION_ID,
      kind: 'resolver',
    });
    expect(params?.routing).toEqual(roleDefault);
    expect(params?.batch?.launchChoice.model).toBe(roleDefault.model);
    expect(params?.batch?.launchChoice.model).not.toBe('gpt-5.5');
  });

  it('reports a thread that left the pull request as missing', async () => {
    const { result } = renderHook(() => useResolveAgain({ sessionId: SESSION_ID, rows: [ROW] }));

    let outcome = '';
    await act(async () => {
      outcome = await result.current({ threadId: 'PRRT_gone', instruction: '' });
    });

    expect(outcome).toBe('missing');
    expect(startResolve).not.toHaveBeenCalled();
  });
});
