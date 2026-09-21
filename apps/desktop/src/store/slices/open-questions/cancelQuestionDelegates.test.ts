import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, OpenQuestion, OpenQuestionId, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  markOpenQuestionDismissed: vi.fn(async () => undefined),
  removeQuestionsFromSlot: vi.fn(async () => true),
  invokeAgentList: vi.fn(async () => [] as ReadonlyArray<Agent>),
  invokeAgentUpdateStatus: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({ markOpenQuestionDismissed: h.markOpenQuestionDismissed }));
vi.mock('@goodboy/core', () => ({ removeQuestionsFromSlot: h.removeQuestionsFromSlot }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: h.invokeAgentList,
  invokeAgentUpdateStatus: h.invokeAgentUpdateStatus,
}));

import { cancelQuestionDelegates } from './cancelQuestionDelegates';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;
const QUESTION_ID = 'oq-1' as OpenQuestionId;
const DELEGATE_ID = 'child-1' as AgentId;

const delegate = {
  id: DELEGATE_ID,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'answer: pick a database',
  status: 'running',
  sourceKind: 'open_question',
  sourceThreadId: QUESTION_ID,
} as unknown as Agent;

const ownQuestion = {
  id: 'oq-child' as OpenQuestionId,
  sessionId: SESSION_ID,
  text: 'which region hosts the primary?',
  suggestedAnswers: [],
  createdByAgentId: DELEGATE_ID,
  userAnswer: null,
  status: 'open',
  createdAt: '2026-09-21T00:00:00.000Z',
} as unknown as OpenQuestion;

type Harness = {
  readonly state: {
    sessionPhaseRuns: Record<string, ReadonlyArray<Agent>>;
    sessionOpenQuestions: Record<string, ReadonlyArray<OpenQuestion>>;
    cancelCurrentTurn: ReturnType<typeof vi.fn>;
    loadSessionOpenQuestions: ReturnType<typeof vi.fn>;
    loadSessionDismissedQuestions: ReturnType<typeof vi.fn>;
    loadSessionSlots: ReturnType<typeof vi.fn>;
  };
  readonly set: SetFn;
  readonly get: GetFn;
};

const createHarness = ({
  openQuestions,
}: {
  readonly openQuestions: ReadonlyArray<OpenQuestion>;
}): Harness => {
  const state = {
    sessionPhaseRuns: { [SESSION_ID]: [delegate] as ReadonlyArray<Agent> },
    sessionOpenQuestions: { [SESSION_ID]: openQuestions },
    cancelCurrentTurn: vi.fn(async () => undefined),
    loadSessionOpenQuestions: vi.fn(async () => undefined),
    loadSessionDismissedQuestions: vi.fn(async () => undefined),
    loadSessionSlots: vi.fn(async () => undefined),
  };
  const set = ((update: unknown) => {
    const patch = typeof update === 'function' ? (update as (s: unknown) => object)(state) : update;
    Object.assign(state, patch);
  }) as SetFn;
  const get = (() => state) as unknown as GetFn;
  return { state, set, get };
};

beforeEach(() => {
  vi.clearAllMocks();
  h.removeQuestionsFromSlot.mockResolvedValue(true);
});

describe('cancelQuestionDelegates', () => {
  it('drops the delegate own questions from the context slot it promised to leave', async () => {
    const { state, set, get } = createHarness({ openQuestions: [ownQuestion] });

    await cancelQuestionDelegates({ set, get, sessionId: SESSION_ID, questionIds: [QUESTION_ID] });

    expect(h.markOpenQuestionDismissed).toHaveBeenCalledWith({}, 'oq-child');
    expect(h.removeQuestionsFromSlot).toHaveBeenCalledWith({}, SESSION_ID, [
      'which region hosts the primary?',
    ]);
    expect(state.loadSessionSlots).toHaveBeenCalledWith(SESSION_ID);
  });

  it('leaves the slots alone when the delegate asked nothing', async () => {
    const { state, set, get } = createHarness({ openQuestions: [] });

    await cancelQuestionDelegates({ set, get, sessionId: SESSION_ID, questionIds: [QUESTION_ID] });

    expect(state.cancelCurrentTurn).toHaveBeenCalledWith(SESSION_ID, DELEGATE_ID);
    expect(h.removeQuestionsFromSlot).not.toHaveBeenCalled();
    expect(state.loadSessionSlots).not.toHaveBeenCalled();
  });
});
