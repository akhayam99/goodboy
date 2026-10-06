// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  OpenQuestion,
  OpenQuestionId,
  ResolveAttempt,
  ResolveThread,
  SessionId,
} from '@goodboy/types';
import { TEST_NOW } from '@goodboy/types/testing';
import type { ResolveQueueRow } from '../../../features/resolve/buildResolveQueueRows';
import type { SessionGithubState } from '../../types';

const h = vi.hoisted(() => ({
  rows: [] as Array<ResolveQueueRow>,
  sendTurn: vi.fn(async (input: { readonly onStarted?: () => void }) => {
    input.onStarted?.();
    return { blockedOverBudget: false };
  }),
  spawnAgent: vi.fn(),
  reportError: vi.fn(async (_params: unknown) => undefined),
  answered: vi.fn(async (_db: unknown, _id: unknown, _answer: unknown) => undefined),
  delivered: vi.fn(async (_params: unknown) => undefined),
  removeFromSlot: vi.fn(async (_db: unknown, _sessionId: unknown, _texts: unknown) => false),
  loadOpen: vi.fn(async (_sessionId: unknown) => undefined),
  loadAnswered: vi.fn(async (_sessionId: unknown) => undefined),
  loadSlots: vi.fn(async (_sessionId: unknown) => undefined),
  updateStatus: vi.fn(async (_id: unknown, _fields: unknown) => undefined),
}));

vi.mock('@goodboy/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/db')>()),
  markOpenQuestionAnswered: h.answered,
  markOpenQuestionAnswersDelivered: h.delivered,
}));
vi.mock('@goodboy/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/core')>()),
  removeQuestionsFromSlot: h.removeFromSlot,
}));
vi.mock('../../../features/resolve/reviewRows', () => ({ launchRowsOf: () => h.rows }));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentUpdateStatus: h.updateStatus,
}));
vi.mock('../../sessionReplySettings', () => ({
  sessionResolveStyle: () => ({
    commitStyle: 'new',
    voice: 'terse',
    styleNote: null,
    worktreePath: null,
  }),
}));

import { useAppStore } from '../../index';
import { answerQuestions } from './answerQuestions';
import { continueResolveThreads } from './continueResolveThreads';
import { retryCouldntFix } from './retryCouldntFix';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-run' as AgentId;
const LAUNCH_ID = 'launch-1';

const attemptOf = (patch: Partial<ResolveAttempt>): ResolveAttempt => ({
  id: 'attempt-1',
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  prNumber: 318,
  threadIds: ['PRRT_1', 'PRRT_2', 'PRRT_3'],
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: null,
  instructions: null,
  phase: 'waiting',
  mountTarget: null,
  startedAt: 1,
  endedAt: 2,
  error: null,
  createdAt: 1,
  batchId: 'batch-1',
  launchId: LAUNCH_ID,
  copyPath: '/copies/attempt-1',
  launchChoice: null,
  ...patch,
});

const threadOf = (patch: Partial<ResolveThread>): ResolveThread => ({
  id: `thread-row-${patch.threadId ?? 'x'}`,
  sessionId: SESSION_ID,
  projectId: null,
  prNumber: 318,
  threadId: 'PRRT_x',
  originKind: 'review_comment',
  diffCommentId: null,
  state: 'fixed',
  stage: 'proposed',
  stateReason: null,
  revision: 1,
  generation: 1,
  reopenedFromThreadId: null,
  activeAttemptId: 'attempt-1',
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
  ...patch,
});

const rowOf = (thread: ResolveThread): ResolveQueueRow => ({
  thread,
  item: {
    id: `item-${thread.threadId}`,
    sessionId: SESSION_ID,
    threadId: thread.threadId,
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
  status: 'ready',
  rowState: {
    state: 'ready',
    node: 'ready',
    sentence: null,
    action: null,
    failedStep: null,
    isRemoteMoved: false,
  },
  attempt: attemptOf({}),
  reviewerNote: null,
  proposal: null,
  proposalKind: 'fix',
  coveredThreadIds: [],
  delivery: null,
  commentThread: {
    head: {
      id: `comment-${thread.threadId}`,
      author: 'harbor-reviewer',
      authorAvatarUrl: null,
      body: `Look at ${thread.threadId}`,
      createdAt: '2026-01-05T09:00:00.000Z',
      url: `https://github.com/acme/payments-api/pull/318#discussion_${thread.threadId}`,
      source: 'review',
      threadId: thread.threadId,
      path: 'src/retryPolicy.ts',
      line: 42,
      resolved: false,
    },
    replies: [],
  },
});

const GITHUB_STATE: SessionGithubState = {
  pr: {
    number: 318,
    title: 'Retry deliveries with a dedupe lock',
    url: 'https://github.com/acme/payments-api/pull/318',
    state: 'open',
    mergeable: true,
    checks: 'success',
    baseBranch: 'main',
    headBranch: 'hl/fix',
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: '2026-01-05T09:00:00.000Z',
  },
  linkedIssues: [],
  fetchedAt: null,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
};

const agent: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Resolve: 3 review comments',
  kind: 'resolver',
  status: 'completed',
  sourceThreadIds: ['PRRT_1', 'PRRT_2', 'PRRT_3'],
};

const question = (patch: Partial<OpenQuestion>): OpenQuestion => ({
  id: 'q-1' as OpenQuestionId,
  sessionId: SESSION_ID,
  createdByAgentId: AGENT_ID,
  text: 'Alias the export or rename it?',
  suggestedAnswers: ['Alias it', 'Rename it'],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: TEST_NOW,
  ...patch,
});

const stateOf = ({
  threads,
  questions = [],
  runAgent = agent,
}: {
  readonly threads: ReadonlyArray<ResolveThread>;
  readonly questions?: ReadonlyArray<OpenQuestion>;
  readonly runAgent?: Agent;
}) => {
  h.rows = threads.map(rowOf);
  useAppStore.setState({
    sessionResolveAttempts: { [SESSION_ID]: [attemptOf({})] },
    sessionResolveThreads: { [SESSION_ID]: threads },
    sessionOpenQuestions: { [SESSION_ID]: questions },
    sessionPhaseRuns: { [SESSION_ID]: [runAgent] },
    sessionGithub: { [SESSION_ID]: GITHUB_STATE },
    sendTurn: h.sendTurn,
    spawnAgent: h.spawnAgent,
    reportError: h.reportError,
    loadSessionOpenQuestions: h.loadOpen,
    loadSessionAnsweredQuestions: h.loadAnswered,
    loadSessionSlots: h.loadSlots,
  });
  return { get: useAppStore.getState };
};

beforeEach(() => {
  h.rows = [];
  h.sendTurn.mockClear();
  h.spawnAgent.mockClear();
  h.reportError.mockClear();
  h.answered.mockClear();
  h.delivered.mockClear();
  h.removeFromSlot.mockClear();
  h.loadOpen.mockClear();
  h.loadAnswered.mockClear();
  h.loadSlots.mockClear();
  h.updateStatus.mockClear();
});

describe('retryCouldntFix', () => {
  it('sends the comments that could not be fixed to the same agent, and starts none', async () => {
    const { get } = stateOf({
      threads: [
        threadOf({ threadId: 'PRRT_1', state: 'failed' }),
        threadOf({ threadId: 'PRRT_2', state: 'fixed' }),
        threadOf({ threadId: 'PRRT_3', state: 'failed' }),
      ],
    });

    await retryCouldntFix({ get, sessionId: SESSION_ID, launchId: LAUNCH_ID });

    expect(h.spawnAgent).not.toHaveBeenCalled();
    expect(h.sendTurn).toHaveBeenCalledTimes(1);
    const input = h.sendTurn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(input).toMatchObject({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      resolveThreadIds: ['PRRT_1', 'PRRT_3'],
    });
    expect(input.resolveCopyPath).toBeUndefined();
    expect(String(input.content)).toContain('Resolve 2 threads');
    expect(String(input.content)).toContain('- thread id: PRRT_1');
    expect(String(input.content)).toContain('- thread id: PRRT_3');
    expect(String(input.content)).not.toContain('- thread id: PRRT_2');
    expect(String(input.content)).toContain('Read it again and decide from scratch');
  });

  it('retries only the comments it is given', async () => {
    const { get } = stateOf({
      threads: [
        threadOf({ threadId: 'PRRT_1', state: 'failed' }),
        threadOf({ threadId: 'PRRT_3', state: 'failed' }),
      ],
    });

    await retryCouldntFix({
      get,
      sessionId: SESSION_ID,
      launchId: LAUNCH_ID,
      threadIds: ['PRRT_3'],
    });

    expect(h.sendTurn).toHaveBeenCalledTimes(1);
    expect(h.sendTurn.mock.calls[0]?.[0]).toMatchObject({ resolveThreadIds: ['PRRT_3'] });
  });

  it('leaves a push that failed to the push, and does nothing when no comment failed', async () => {
    const { get } = stateOf({
      threads: [
        threadOf({
          threadId: 'PRRT_1',
          state: 'failed',
          stateReason: 'publication_failed:{"error":"no network"}',
        }),
        threadOf({ threadId: 'PRRT_2', state: 'fixed' }),
      ],
    });

    await retryCouldntFix({ get, sessionId: SESSION_ID, launchId: LAUNCH_ID });

    expect(h.sendTurn).not.toHaveBeenCalled();
  });

  it('opens a stopped agent again before it works', async () => {
    const { get } = stateOf({
      threads: [threadOf({ threadId: 'PRRT_1', state: 'failed' })],
      runAgent: { ...agent, status: 'skipped' },
    });

    await retryCouldntFix({ get, sessionId: SESSION_ID, launchId: LAUNCH_ID });

    expect(h.updateStatus).toHaveBeenCalledWith(AGENT_ID, { status: 'pending' });
    expect(h.sendTurn).toHaveBeenCalledTimes(1);
  });

  it('says so when the agent of the run is gone', async () => {
    const { get } = stateOf({
      threads: [threadOf({ threadId: 'PRRT_1', state: 'failed' })],
    });
    useAppStore.setState({ sessionPhaseRuns: { [SESSION_ID]: [] } });

    await expect(
      retryCouldntFix({ get, sessionId: SESSION_ID, launchId: LAUNCH_ID }),
    ).rejects.toThrow('no longer available');
    expect(h.sendTurn).not.toHaveBeenCalled();
  });
});

describe('answerQuestions', () => {
  it('sends an answer to the agent that asked, in the same run, and marks the question answered', async () => {
    const { get } = stateOf({
      threads: [
        threadOf({
          threadId: 'PRRT_2',
          state: 'needs_answer',
          question: 'Alias the export or rename it?',
        }),
        threadOf({ threadId: 'PRRT_1', state: 'fixed' }),
      ],
      questions: [question({})],
    });

    await answerQuestions({
      get,
      sessionId: SESSION_ID,
      launchId: LAUNCH_ID,
      answers: [{ threadId: 'PRRT_2', answer: 'Alias it' }],
    });

    expect(h.spawnAgent).not.toHaveBeenCalled();
    expect(h.sendTurn).toHaveBeenCalledTimes(1);
    const input = h.sendTurn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(input).toMatchObject({ agentId: AGENT_ID, resolveThreadIds: ['PRRT_2'] });
    expect(String(input.content)).toContain(
      '- the question you asked:\n> Alias the export or rename it?',
    );
    expect(String(input.content)).toContain('- the answer:\n> Alias it');
    expect(h.answered).toHaveBeenCalledWith(expect.anything(), 'q-1', 'Alias it');
    expect(h.removeFromSlot).toHaveBeenCalledWith(expect.anything(), SESSION_ID, [
      'Alias the export or rename it?',
    ]);
    expect(h.delivered).toHaveBeenCalledWith({ db: expect.anything(), ids: ['q-1'] });
  });

  it('continues the run once for several answers', async () => {
    const { get } = stateOf({
      threads: [
        threadOf({ threadId: 'PRRT_1', state: 'needs_answer', question: 'First?' }),
        threadOf({ threadId: 'PRRT_2', state: 'needs_answer', question: 'Second?' }),
      ],
      questions: [
        question({ id: 'q-1' as OpenQuestionId, text: 'First?' }),
        question({ id: 'q-2' as OpenQuestionId, text: 'Second?' }),
      ],
    });

    await answerQuestions({
      get,
      sessionId: SESSION_ID,
      launchId: LAUNCH_ID,
      answers: [
        { threadId: 'PRRT_1', answer: 'Yes' },
        { threadId: 'PRRT_2', answer: 'No' },
      ],
    });

    expect(h.sendTurn).toHaveBeenCalledTimes(1);
    expect(h.sendTurn.mock.calls[0]?.[0]).toMatchObject({
      resolveThreadIds: ['PRRT_1', 'PRRT_2'],
    });
    expect(h.delivered).toHaveBeenCalledWith({ db: expect.anything(), ids: ['q-1', 'q-2'] });
  });

  it('answers a question that came from the agent last message, with no question row', async () => {
    const { get } = stateOf({
      threads: [
        threadOf({
          threadId: 'PRRT_1',
          state: 'needs_answer',
          question: 'I changed the guard. Can I commit?',
        }),
      ],
    });

    await answerQuestions({
      get,
      sessionId: SESSION_ID,
      launchId: LAUNCH_ID,
      answers: [{ threadId: 'PRRT_1', answer: 'Yes, commit it' }],
    });

    expect(h.answered).not.toHaveBeenCalled();
    expect(
      String(
        h.sendTurn.mock.calls[0]?.[0] &&
          (h.sendTurn.mock.calls[0][0] as { content: string }).content,
      ),
    ).toContain('I changed the guard. Can I commit?');
  });

  it('marks the question delivered only once the continuation turn has started', async () => {
    const { get } = stateOf({
      threads: [
        threadOf({
          threadId: 'PRRT_2',
          state: 'needs_answer',
          question: 'Alias the export or rename it?',
        }),
      ],
      questions: [question({})],
    });
    let startTurn = () => {};
    h.sendTurn.mockImplementationOnce(async (input) => {
      await new Promise<void>((resolve) => {
        startTurn = resolve;
      });
      input.onStarted?.();
      return { blockedOverBudget: false };
    });

    const pending = answerQuestions({
      get,
      sessionId: SESSION_ID,
      launchId: LAUNCH_ID,
      answers: [{ threadId: 'PRRT_2', answer: 'Alias it' }],
    });
    await vi.waitFor(() => expect(h.sendTurn).toHaveBeenCalledTimes(1));

    expect(h.answered).not.toHaveBeenCalled();
    expect(h.delivered).not.toHaveBeenCalled();

    startTurn();
    await pending;

    expect(h.answered).toHaveBeenCalledWith(expect.anything(), 'q-1', 'Alias it');
    expect(h.delivered).toHaveBeenCalledWith({ db: expect.anything(), ids: ['q-1'] });
  });

  it('keeps the question open and shows no answer when the turn fails to start', async () => {
    const { get } = stateOf({
      threads: [
        threadOf({
          threadId: 'PRRT_2',
          state: 'needs_answer',
          question: 'Alias the export or rename it?',
        }),
      ],
      questions: [question({})],
    });
    h.sendTurn.mockRejectedValueOnce(new Error('the provider could not be started'));

    await expect(
      get().answerQuestions({
        sessionId: SESSION_ID,
        launchId: LAUNCH_ID,
        answers: [{ threadId: 'PRRT_2', answer: 'Alias it' }],
      }),
    ).rejects.toThrow('the provider could not be started');

    expect(h.answered).not.toHaveBeenCalled();
    expect(h.removeFromSlot).not.toHaveBeenCalled();
    expect(h.delivered).not.toHaveBeenCalled();
    expect(get().sessionOpenQuestions[SESSION_ID]?.[0]?.status).toBe('open');
    expect(get().sessionResolveAnswers[SESSION_ID]?.PRRT_2).toBeUndefined();
    expect(h.reportError).not.toHaveBeenCalled();
  });

  it('keeps the question open when the turn is refused before it starts', async () => {
    const { get } = stateOf({
      threads: [
        threadOf({
          threadId: 'PRRT_2',
          state: 'needs_answer',
          question: 'Alias the export or rename it?',
        }),
      ],
      questions: [question({})],
    });
    h.sendTurn.mockResolvedValueOnce({ blockedOverBudget: true });

    await expect(
      answerQuestions({
        get,
        sessionId: SESSION_ID,
        launchId: LAUNCH_ID,
        answers: [{ threadId: 'PRRT_2', answer: 'Alias it' }],
      }),
    ).rejects.toThrow('session budget is reached');

    expect(h.answered).not.toHaveBeenCalled();
    expect(h.delivered).not.toHaveBeenCalled();
  });

  it('ignores an empty answer and refuses a comment that is not part of the run', async () => {
    const { get } = stateOf({
      threads: [threadOf({ threadId: 'PRRT_1', state: 'needs_answer', question: 'First?' })],
    });

    await answerQuestions({
      get,
      sessionId: SESSION_ID,
      launchId: LAUNCH_ID,
      answers: [{ threadId: 'PRRT_1', answer: '   ' }],
    });
    expect(h.sendTurn).not.toHaveBeenCalled();

    await expect(
      answerQuestions({
        get,
        sessionId: SESSION_ID,
        launchId: 'another-launch',
        answers: [{ threadId: 'PRRT_1', answer: 'Yes' }],
      }),
    ).rejects.toThrow('not part of this fix run');
    expect(h.sendTurn).not.toHaveBeenCalled();
  });
});

describe('continueResolveThreads', () => {
  it('sends the owner hint along with the comment to the same agent', async () => {
    const { get } = stateOf({ threads: [threadOf({ threadId: 'PRRT_1', state: 'fixed' })] });

    await continueResolveThreads({
      get,
      sessionId: SESSION_ID,
      threadIds: ['PRRT_1'],
      hint: 'Prefer a guard clause',
    });

    expect(h.spawnAgent).not.toHaveBeenCalled();
    expect(h.sendTurn).toHaveBeenCalledTimes(1);
    const input = h.sendTurn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(input).toMatchObject({ agentId: AGENT_ID, resolveThreadIds: ['PRRT_1'] });
    expect(String(input.content)).toContain('Operator notes\nPrefer a guard clause');
  });
});
