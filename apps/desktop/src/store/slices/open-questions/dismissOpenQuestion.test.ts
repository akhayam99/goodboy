import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand';
import type { IsoDateTime, OpenQuestion, OpenQuestionId, SessionId } from '@goodboy/types';

const {
  addQuestionsToSlot,
  markOpenQuestionDismissed,
  removeQuestionsFromSlot,
  restoreOpenQuestion,
} = vi.hoisted(() => ({
  addQuestionsToSlot: vi.fn(async () => false),
  markOpenQuestionDismissed: vi.fn(async () => undefined),
  removeQuestionsFromSlot: vi.fn(async () => false),
  restoreOpenQuestion: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({
  markOpenQuestionDismissed,
  restoreOpenQuestion,
}));
vi.mock('@goodboy/core', () => ({
  addQuestionsToSlot,
  removeQuestionsFromSlot,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { BLOCKING_DISMISSAL_REFUSAL, dismissOpenQuestion } from './dismissOpenQuestion';
import { restoreDismissedOpenQuestion } from './restoreDismissedOpenQuestion';

type RecordedEvent = {
  sessionId: SessionId;
  kind: string;
  payload?: Record<string, unknown>;
};

type TestState = {
  sessionOpenQuestions: Record<string, ReadonlyArray<OpenQuestion>>;
  loadSessionSlots: (sessionId: SessionId) => Promise<void>;
  loadSessionDismissedQuestions: (sessionId: SessionId) => Promise<void>;
  maybeAutoAdvanceWorkflow: (sessionId: SessionId) => Promise<void>;
  recordSessionEvent: (event: RecordedEvent) => Promise<void>;
  emitNotification: (...args: ReadonlyArray<unknown>) => Promise<void>;
};

const makeStore = (questions: ReadonlyArray<OpenQuestion>) =>
  createStore<TestState>(() => ({
    sessionOpenQuestions: { [sessionId]: questions },
    loadSessionSlots: vi.fn(async () => undefined),
    loadSessionDismissedQuestions: vi.fn(async () => undefined),
    maybeAutoAdvanceWorkflow: vi.fn(async () => undefined),
    recordSessionEvent: vi.fn(async () => undefined),
    emitNotification: vi.fn(async () => undefined),
  }));

const sessionId = 'sess-1' as SessionId;
const question = {
  id: 'oq-1' as OpenQuestionId,
  sessionId,
  text: 'Which database?',
  suggestedAnswers: ['SQLite'],
  isBlocking: false,
  userAnswer: null,
  status: 'open',
  createdAt: '2026-07-30T10:00:00.000Z' as IsoDateTime,
} satisfies OpenQuestion;

describe('dismissed open question restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('round-trips a dismissed question through persistence and store state', async () => {
    const store = makeStore([question]);
    const dismiss = dismissOpenQuestion(store.setState as never, store.getState as never);
    const restore = restoreDismissedOpenQuestion(store.setState as never, store.getState as never);

    await dismiss(sessionId, question);
    expect(store.getState().sessionOpenQuestions[sessionId]).toEqual([]);
    expect(markOpenQuestionDismissed).toHaveBeenCalledWith(expect.anything(), question.id);
    expect(store.getState().loadSessionDismissedQuestions).toHaveBeenCalledWith(sessionId);

    await restore(sessionId, question);
    expect(store.getState().sessionOpenQuestions[sessionId]).toEqual([question]);
    expect(restoreOpenQuestion).toHaveBeenCalledWith(expect.anything(), question.id);
    expect(store.getState().loadSessionDismissedQuestions).toHaveBeenCalledTimes(2);
    expect(store.getState().maybeAutoAdvanceWorkflow).toHaveBeenCalledWith(sessionId);
  });

  it('writes the discard and the recovery to the session timeline', async () => {
    const store = makeStore([question]);
    const dismiss = dismissOpenQuestion(store.setState as never, store.getState as never);
    const restore = restoreDismissedOpenQuestion(store.setState as never, store.getState as never);

    await dismiss(sessionId, question);
    await restore(sessionId, question);

    expect(store.getState().recordSessionEvent).toHaveBeenNthCalledWith(1, {
      sessionId,
      kind: 'question_dismissed',
      payload: { questionId: question.id, title: question.text },
    });
    expect(store.getState().recordSessionEvent).toHaveBeenNthCalledWith(2, {
      sessionId,
      kind: 'question_restored',
      payload: { questionId: question.id, title: question.text },
    });
  });
});

describe('blocking question dismissal', () => {
  const blocking = { ...question, id: 'oq-2' as OpenQuestionId, isBlocking: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses a blocking question, keeps it on screen and advances no workflow', async () => {
    const store = makeStore([blocking]);
    const dismiss = dismissOpenQuestion(store.setState as never, store.getState as never);

    await dismiss(sessionId, blocking);

    expect(markOpenQuestionDismissed).not.toHaveBeenCalled();
    expect(removeQuestionsFromSlot).not.toHaveBeenCalled();
    expect(store.getState().sessionOpenQuestions[sessionId]).toEqual([blocking]);
    expect(store.getState().maybeAutoAdvanceWorkflow).not.toHaveBeenCalled();
    expect(store.getState().recordSessionEvent).not.toHaveBeenCalled();
  });

  it('says why instead of failing silently', async () => {
    const store = makeStore([blocking]);
    const dismiss = dismissOpenQuestion(store.setState as never, store.getState as never);

    await dismiss(sessionId, blocking);

    expect(store.getState().emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        severity: 'warning',
        title: 'This question cannot be discarded',
        body: BLOCKING_DISMISSAL_REFUSAL,
        sessionId,
        coalesceKey: `blocking-question:${blocking.id}`,
      }),
    );
  });

  it('still dismisses a non blocking question', async () => {
    const store = makeStore([question]);
    const dismiss = dismissOpenQuestion(store.setState as never, store.getState as never);

    await dismiss(sessionId, question);

    expect(markOpenQuestionDismissed).toHaveBeenCalledWith(expect.anything(), question.id);
    expect(store.getState().sessionOpenQuestions[sessionId]).toEqual([]);
    expect(store.getState().maybeAutoAdvanceWorkflow).toHaveBeenCalledWith(sessionId);
  });
});
