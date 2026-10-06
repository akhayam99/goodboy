// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { AgentId, PrComment, ResolveAttempt, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { EMPTY_RESOLVE_QUEUE_VIEW } from '../../../../store/slices/session-view/types';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';
import { useResolveAgain } from './index';

const { startBatch } = vi.hoisted(() => ({
  startBatch: vi.fn(async (_params: unknown) => ({
    batchId: 'batch-2',
    launchId: 'launch-2',
    agentId: 'agent-2',
  })),
}));

vi.mock('../../startBatch', () => ({ startBatch }));

const SESSION_ID = 'session-retry' as SessionId;

const ATTEMPT: ResolveAttempt = {
  id: 'attempt-1',
  sessionId: SESSION_ID,
  agentId: 'agent-1' as AgentId,
  prNumber: 248,
  threadIds: ['PRRT_1'],
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  instructions: null,
  phase: 'finished',
  mountTarget: null,
  startedAt: 1,
  endedAt: 2,
  error: null,
  createdAt: 1,
  batchId: 'batch-1',
  launchId: 'launch-1',
  copyPath: null,
  launchChoice: null,
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

const ROW: ResolveQueueRow = {
  thread: {
    id: 'thread-row-1',
    sessionId: SESSION_ID,
    projectId: null,
    prNumber: 248,
    threadId: 'PRRT_1',
    originKind: 'review_comment',
    diffCommentId: null,
    state: 'open',
    stage: 'proposed',
    stateReason: null,
    revision: 1,
    generation: 1,
    reopenedFromThreadId: null,
    activeAttemptId: 'attempt-1',
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
  commentThread: { head: REVIEW_COMMENT, replies: [] },
  status: 'ready',
  rowState: {
    state: 'ready',
    node: 'ready',
    sentence: null,
    action: null,
    failedStep: null,
    isRemoteMoved: false,
  },
  attempt: ATTEMPT,
  reviewerNote: null,
  proposal: null,
  proposalKind: 'fix',
  coveredThreadIds: [],
  delivery: null,
};

const continueResolveThreads = vi.fn(async (_params: unknown) => undefined);
const reportError = vi.fn(async (_params: unknown) => undefined);
const spawnAgent = vi.fn();

const pickRouting = ({
  model,
  effort,
}: {
  readonly model: string;
  readonly effort: 'medium' | 'high';
}) =>
  useAppStore.setState({
    resolveQueueView: {
      [SESSION_ID]: {
        ...EMPTY_RESOLVE_QUEUE_VIEW,
        lastRouting: { provider: 'anthropic', model, effort },
      },
    },
  });

beforeEach(() => {
  continueResolveThreads.mockClear();
  reportError.mockClear();
  spawnAgent.mockClear();
  startBatch.mockClear();
  useAppStore.setState({
    continueResolveThreads,
    reportError,
    spawnAgent,
    resolveQueueView: {},
  });
});

afterEach(() => {
  cleanup();
});

describe('useResolveAgain', () => {
  it('continues the fix run of the comment with the instruction, without starting an agent', async () => {
    const { result } = renderHook(() => useResolveAgain({ sessionId: SESSION_ID, rows: [ROW] }));

    let outcome = '';
    await act(async () => {
      outcome = await result.current({ threadId: 'PRRT_1', instruction: 'Use ON CONFLICT' });
    });

    expect(outcome).toBe('started');
    expect(continueResolveThreads).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      threadIds: ['PRRT_1'],
      hint: 'Use ON CONFLICT',
    });
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('starts the comment over on another model only when the owner picked one', async () => {
    pickRouting({ model: 'claude-opus-5', effort: 'high' });
    const { result } = renderHook(() => useResolveAgain({ sessionId: SESSION_ID, rows: [ROW] }));

    await act(async () => {
      await result.current({ threadId: 'PRRT_1', instruction: 'Try the other way' });
    });

    expect(startBatch).toHaveBeenCalledOnce();
    expect(startBatch.mock.calls[0]?.[0]).toMatchObject({
      sessionId: SESSION_ID,
      threadIds: ['PRRT_1'],
      launchChoice: { model: 'claude-opus-5', effort: 'high', hint: 'Try the other way' },
    });
    expect(continueResolveThreads).not.toHaveBeenCalled();
  });

  it('keeps the same run when the picked model is the one the attempt used', async () => {
    pickRouting({ model: 'claude-sonnet-5-5', effort: 'medium' });
    const { result } = renderHook(() => useResolveAgain({ sessionId: SESSION_ID, rows: [ROW] }));

    await act(async () => {
      await result.current({ threadId: 'PRRT_1', instruction: '' });
    });

    expect(startBatch).not.toHaveBeenCalled();
    expect(continueResolveThreads).toHaveBeenCalledOnce();
  });

  it('reports a thread that left the pull request as missing', async () => {
    const { result } = renderHook(() => useResolveAgain({ sessionId: SESSION_ID, rows: [ROW] }));

    let outcome = '';
    await act(async () => {
      outcome = await result.current({ threadId: 'PRRT_gone', instruction: '' });
    });

    expect(outcome).toBe('missing');
    expect(continueResolveThreads).not.toHaveBeenCalled();
  });

  it('reports a comment nobody has run yet as missing, since there is no run to continue', async () => {
    const fresh: ResolveQueueRow = { ...ROW, attempt: null };
    const { result } = renderHook(() => useResolveAgain({ sessionId: SESSION_ID, rows: [fresh] }));

    let outcome = '';
    await act(async () => {
      outcome = await result.current({ threadId: 'PRRT_1', instruction: '' });
    });

    expect(outcome).toBe('missing');
    expect(continueResolveThreads).not.toHaveBeenCalled();
  });

  it('reports the failure when the run cannot be continued', async () => {
    continueResolveThreads.mockRejectedValueOnce(new Error('This fix run is no longer available'));
    const { result } = renderHook(() => useResolveAgain({ sessionId: SESSION_ID, rows: [ROW] }));

    let outcome = '';
    await act(async () => {
      outcome = await result.current({ threadId: 'PRRT_1', instruction: '' });
    });

    expect(outcome).toBe('failed');
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't retry the fix", sessionId: SESSION_ID }),
    );
  });
});
