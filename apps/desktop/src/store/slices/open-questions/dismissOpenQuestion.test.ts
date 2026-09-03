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

import { dismissOpenQuestion } from './dismissOpenQuestion';
import { restoreDismissedOpenQuestion } from './restoreDismissedOpenQuestion';

type TestState = {
  sessionOpenQuestions: Record<string, ReadonlyArray<OpenQuestion>>;
  loadSessionSlots: (sessionId: SessionId) => Promise<void>;
  loadSessionDismissedQuestions: (sessionId: SessionId) => Promise<void>;
  maybeAutoAdvanceWorkflow: (sessionId: SessionId) => Promise<void>;
};

const sessionId = 'sess-1' as SessionId;
const question = {
  id: 'oq-1' as OpenQuestionId,
  sessionId,
  text: 'Which database?',
  suggestedAnswers: ['SQLite'],
  userAnswer: null,
  status: 'open',
  createdAt: '2026-07-30T10:00:00.000Z' as IsoDateTime,
} satisfies OpenQuestion;

describe('dismissed open question restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('round-trips a dismissed question through persistence and store state', async () => {
    const store = createStore<TestState>(() => ({
      sessionOpenQuestions: { [sessionId]: [question] },
      loadSessionSlots: vi.fn(async () => undefined),
      loadSessionDismissedQuestions: vi.fn(async () => undefined),
      maybeAutoAdvanceWorkflow: vi.fn(async () => undefined),
    }));
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
});
