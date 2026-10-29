import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertOpenQuestion, insertWorkspace } from '@goodboy/db';
import { brandId, type OpenQuestionId, type SessionId, type WorkspaceId } from '@goodboy/types';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';

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
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
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

const failDeliveryOnce = () => {
  const sendTurn = vi
    .fn()
    .mockRejectedValueOnce(new Error('The agent is not reachable.'))
    .mockResolvedValue({ blockedOverBudget: false, isAlreadySent: false });
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
    sendTurn.mockResolvedValue({ blockedOverBudget: false, isAlreadySent: false });

    await useAppStore
      .getState()
      .retryOpenQuestionDelivery({ sessionId, attemptId: olderAttemptId });

    expect(newerAttemptId).not.toBe(olderAttemptId);
    expect(sendTurn).not.toHaveBeenCalled();
    expect(pending()?.attemptId).toBe(newerAttemptId);
    expect(pending()?.pairs.map((pair) => pair.id)).toEqual([THIRD_ID]);
  });
});
