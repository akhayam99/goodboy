import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertAgent, insertOpenQuestion, insertWorkspace } from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type OpenQuestionId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';
import { answersInFlight } from './slices/open-questions/answersInFlight';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const FIRST_ID = brandId<OpenQuestionId>({ value: 'question-settlement-alias' });
const SECOND_ID = brandId<OpenQuestionId>({ value: 'question-settlement-retry' });
const FIRST_TEXT = 'Keep the legacy settlement route as an alias?';
const SECOND_TEXT = 'Should ledger-core retry a failed settlement?';

const harborline = buildStoryWorkspace({
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
});

let useAppStore: StoryStore;
let sessionId: SessionId;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ workspaces_with_unread: [] });
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: harborline });
  useAppStore.setState({
    workspaces: [harborline],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [],
    sessions: [],
    archivedSessions: {},
  });
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    goal: 'Settle payments between payments-api and ledger-core',
  });
  sessionId = session.id;
  await insertOpenQuestion(storySqlite(), {
    id: FIRST_ID,
    sessionId,
    text: FIRST_TEXT,
    suggestedAnswers: [],
    isBlocking: true,
  });
  await insertOpenQuestion(storySqlite(), {
    id: SECOND_ID,
    sessionId,
    text: SECOND_TEXT,
    suggestedAnswers: [],
    isBlocking: true,
  });
  await useAppStore.getState().loadSessionOpenQuestions(sessionId);
});

const pairs = [
  { id: FIRST_ID, text: FIRST_TEXT, answer: 'Keep it' },
  { id: SECOND_ID, text: SECOND_TEXT, answer: 'Yes, twice' },
];

type TurnParams = {
  readonly agentId?: AgentId;
  readonly onStarted?: () => void;
};

const startedTurn = async ({ onStarted }: TurnParams) => {
  onStarted?.();
  return { blockedOverBudget: false };
};

const failDeliveryOnce = () => {
  const sendTurn = vi
    .fn()
    .mockRejectedValueOnce(new Error('The agent is not reachable.'))
    .mockImplementation(startedTurn);
  useAppStore.setState({ sendTurn });
  return sendTurn;
};

const isAnswerWrite = (sql: string): boolean => /SET status = 'answered'/i.test(sql);

const THIRD_ID = brandId<OpenQuestionId>({ value: 'question-settlement-fees' });
const THIRD_TEXT = 'Should payments-api show the settlement fee?';

const askAThirdQuestion = async (): Promise<void> => {
  await insertOpenQuestion(storySqlite(), {
    id: THIRD_ID,
    sessionId,
    text: THIRD_TEXT,
    suggestedAnswers: [],
    isBlocking: true,
  });
  await useAppStore.getState().loadSessionOpenQuestions(sessionId);
};

const pending = () => useAppStore.getState().pendingOpenQuestionDeliveries[sessionId];

const PLANNER_ID = brandId<AgentId>({ value: 'agent-planner-ledger' });
const TESTER_ID = brandId<AgentId>({ value: 'agent-tester-ledger' });

type AskedParams = {
  readonly id: OpenQuestionId;
  readonly text: string;
  readonly agentId: AgentId;
};

const askedBy = async ({ id, text, agentId }: AskedParams): Promise<void> => {
  await insertOpenQuestion(storySqlite(), {
    id,
    sessionId,
    text,
    suggestedAnswers: [],
    isBlocking: true,
    createdByAgentId: agentId,
  });
};

const twoAskingAgents = async (): Promise<void> => {
  await storySqlite().execute('DELETE FROM open_questions');
  for (const agent of [
    anAgent({ id: PLANNER_ID, sessionId, name: 'Planner' }),
    anAgent({ id: TESTER_ID, sessionId, name: 'Tester', ordinal: 1 }),
  ]) {
    await insertAgent(storySqlite(), {
      id: agent.id,
      sessionId,
      ordinal: agent.ordinal,
      name: agent.name,
      status: 'pending',
    });
  }
  useAppStore.setState((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: [
        anAgent({ id: PLANNER_ID, sessionId, name: 'Planner' }),
        anAgent({ id: TESTER_ID, sessionId, name: 'Tester', ordinal: 1 }),
      ],
    },
  }));
  await askedBy({ id: FIRST_ID, text: FIRST_TEXT, agentId: PLANNER_ID });
  await askedBy({ id: SECOND_ID, text: SECOND_TEXT, agentId: TESTER_ID });
  await useAppStore.getState().loadSessionOpenQuestions(sessionId);
};

const deliveredRows = async () =>
  (
    await rowsOf<{ count: number }>({
      sql: 'SELECT COUNT(*) AS count FROM open_questions WHERE answer_delivered_at IS NOT NULL',
      params: [],
    })
  )[0]?.count ?? 0;

const deliveredIds = () =>
  (useAppStore.getState().sessionAnsweredQuestions[sessionId] ?? [])
    .filter((question) => question.answerDeliveredAt !== undefined)
    .map((question) => question.id);

describe('answers commit per agent, after the agent got them', () => {
  it('marks the agent that got its answers and keeps the refused one undelivered', async () => {
    await twoAskingAgents();
    const sendTurn = vi.fn(async (params: TurnParams) =>
      params.agentId === TESTER_ID ? { blockedOverBudget: true } : startedTurn(params),
    );
    useAppStore.setState({ sendTurn });

    await expect(
      useAppStore.getState().answerOpenQuestions(sessionId, pairs, null),
    ).rejects.toThrow('Every provider is over its limit');

    expect(sendTurn).toHaveBeenCalledTimes(2);
    expect(deliveredIds()).toEqual([FIRST_ID]);
    expect(pending()?.error).toContain('over its limit');

    sendTurn.mockClear();
    sendTurn.mockImplementation(startedTurn);
    await useAppStore
      .getState()
      .retryOpenQuestionDelivery({ sessionId, attemptId: pending()?.attemptId ?? '' });

    expect(sendTurn).toHaveBeenCalledTimes(1);
    expect(sendTurn.mock.calls[0]?.[0].agentId).toBe(TESTER_ID);
    expect([...deliveredIds()].sort()).toEqual([FIRST_ID, SECOND_ID].sort());
    expect(pending()).toBeUndefined();
  });

  it('shows answers saved before a reload but never sent as Not delivered, and Retry sends them', async () => {
    await twoAskingAgents();
    useAppStore.setState({ sendTurn: vi.fn(async () => ({ blockedOverBudget: true })) });
    await expect(
      useAppStore.getState().answerOpenQuestions(sessionId, pairs, null),
    ).rejects.toThrow('over its limit');
    useAppStore.setState((state) => ({
      pendingOpenQuestionDeliveries: {
        ...state.pendingOpenQuestionDeliveries,
        [sessionId]: undefined,
      },
      sessionAnsweredQuestions: {},
    }));

    await useAppStore.getState().loadSessionAnsweredQuestions(sessionId);
    useAppStore.getState().flagUndeliveredAnswers({ sessionId });

    expect(
      pending()
        ?.pairs.map((pair) => pair.id)
        .sort(),
    ).toEqual([FIRST_ID, SECOND_ID].sort());
    const sendTurn = vi.fn(startedTurn);
    useAppStore.setState({ sendTurn });
    await useAppStore
      .getState()
      .retryOpenQuestionDelivery({ sessionId, attemptId: pending()?.attemptId ?? '' });
    expect(sendTurn).toHaveBeenCalledTimes(2);
    expect(pending()).toBeUndefined();
  });

  it('flags nothing when every saved answer reached its agent', async () => {
    await twoAskingAgents();
    useAppStore.setState({ sendTurn: vi.fn(startedTurn) });
    await useAppStore.getState().answerOpenQuestions(sessionId, pairs, null);

    useAppStore.getState().flagUndeliveredAnswers({ sessionId });

    expect(pending()).toBeUndefined();
  });

  it('never offers to send answers again after a reload in the middle of the turn', async () => {
    await twoAskingAgents();
    const turnEnd: { finish: () => void } = { finish: () => undefined };
    const sendTurn = vi.fn(async ({ onStarted }: TurnParams) => {
      onStarted?.();
      await new Promise<void>((resolve) => {
        turnEnd.finish = resolve;
      });
      return { blockedOverBudget: false };
    });
    useAppStore.setState({ sendTurn });
    const answering = useAppStore.getState().answerOpenQuestions(sessionId, pairs, null);
    await vi.waitFor(async () => expect(await deliveredRows()).toBe(1));
    answersInFlight.end({ sessionId });
    useAppStore.setState({ sessionAnsweredQuestions: {} });

    await useAppStore.getState().loadSessionAnsweredQuestions(sessionId);
    useAppStore.getState().flagUndeliveredAnswers({ sessionId });

    expect(deliveredIds()).toEqual([FIRST_ID]);
    expect(pending()?.pairs.map((pair) => pair.id)).toEqual([SECOND_ID]);
    answersInFlight.begin({ sessionId });
    turnEnd.finish();
    await vi.waitFor(() => expect(sendTurn).toHaveBeenCalledTimes(2));
    turnEnd.finish();
    await answering;
  });

  it('keeps answers undelivered when the agent never started', async () => {
    await twoAskingAgents();
    useAppStore.setState({ sendTurn: vi.fn(async () => ({ blockedOverBudget: false })) });

    await expect(
      useAppStore.getState().answerOpenQuestions(sessionId, pairs, null),
    ).rejects.toThrow('The agent did not start');

    expect(deliveredIds()).toEqual([]);
    expect(
      pending()
        ?.pairs.map((pair) => pair.id)
        .sort(),
    ).toEqual([FIRST_ID, SECOND_ID].sort());
  });
});

describe('answering open questions when the delivery fails after the answers are saved', () => {
  it('keeps the same batch retryable, re-sends without saving twice and clears on success', async () => {
    const sendTurn = failDeliveryOnce();
    const execute = vi.spyOn(storySqlite(), 'execute');

    await expect(
      useAppStore.getState().answerOpenQuestions(sessionId, pairs, null),
    ).rejects.toThrow('The agent is not reachable.');

    expect(useAppStore.getState().sessionOpenQuestions[sessionId] ?? []).toHaveLength(0);
    expect(pending()?.pairs.map((pair) => pair.id)).toEqual([FIRST_ID, SECOND_ID]);
    expect(pending()?.error).toContain('The agent is not reachable.');
    const savedWrites = execute.mock.calls.filter(([sql]) => isAnswerWrite(String(sql))).length;
    expect(savedWrites).toBe(2);

    await useAppStore
      .getState()
      .retryOpenQuestionDelivery({ sessionId, attemptId: pending()?.attemptId ?? '' });

    expect(sendTurn).toHaveBeenCalledTimes(2);
    expect(sendTurn.mock.calls[1]?.[0].content).toContain('A: Keep it');
    expect(sendTurn.mock.calls[1]?.[0].content).toContain('A: Yes, twice');
    expect(execute.mock.calls.filter(([sql]) => isAnswerWrite(String(sql))).length).toBe(
      savedWrites,
    );
    expect(pending()).toBeUndefined();
  });

  it('keeps the pending batch and its error when the retry fails too', async () => {
    const sendTurn = vi.fn().mockRejectedValue(new Error('Still not reachable.'));
    useAppStore.setState({ sendTurn });
    await expect(
      useAppStore.getState().answerOpenQuestions(sessionId, pairs, null),
    ).rejects.toThrow('Still not reachable.');
    const attemptId = pending()?.attemptId ?? '';

    await useAppStore.getState().retryOpenQuestionDelivery({ sessionId, attemptId });

    expect(sendTurn).toHaveBeenCalledTimes(2);
    expect(pending()?.attemptId).toBe(attemptId);
    expect(pending()?.error).toContain('Still not reachable.');
  });

  it('does not let a late retry of an older attempt clear a newer pending batch', async () => {
    const sendTurn = vi.fn().mockRejectedValue(new Error('Not reachable.'));
    useAppStore.setState({ sendTurn });
    await expect(
      useAppStore.getState().answerOpenQuestions(sessionId, pairs, null),
    ).rejects.toThrow('Not reachable.');
    const olderAttemptId = pending()?.attemptId ?? '';
    await askAThirdQuestion();
    await expect(
      useAppStore
        .getState()
        .answerOpenQuestions(
          sessionId,
          [{ id: THIRD_ID, text: THIRD_TEXT, answer: 'Show it' }],
          null,
        ),
    ).rejects.toThrow('Not reachable.');
    const newerAttemptId = pending()?.attemptId ?? '';
    sendTurn.mockClear();
    sendTurn.mockImplementation(startedTurn);

    await useAppStore
      .getState()
      .retryOpenQuestionDelivery({ sessionId, attemptId: olderAttemptId });

    expect(newerAttemptId).not.toBe(olderAttemptId);
    expect(sendTurn).not.toHaveBeenCalled();
    expect(pending()?.attemptId).toBe(newerAttemptId);
    expect(pending()?.pairs.map((pair) => pair.id)).toEqual([THIRD_ID]);
  });
});
