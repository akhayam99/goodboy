import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, OpenQuestion, OpenQuestionId, SessionId } from '@goodboy/types';

type Row = {
  id: string;
  text: string;
  createdByAgentId?: string;
  status: 'open' | 'answered' | 'dismissed';
  userAnswer: string | null;
  answerSource?: 'user' | 'agent';
  answeredByAgentId?: string;
  answerDeliveredAt?: string;
};

const h = vi.hoisted(() => {
  const rows: Row[] = [];
  return {
    rows,
    getOpenQuestionById: vi.fn(async ({ id }: { db: unknown; id: string }) => {
      const row = rows.find((candidate) => candidate.id === id);
      return row === undefined ? null : row;
    }),
    markOpenQuestionAnswered: vi.fn(
      async (
        _db: unknown,
        id: string,
        answer: string,
        provenance?: { source: 'user' | 'agent'; agentId?: string },
      ) => {
        const row = rows.find((candidate) => candidate.id === id);
        if (row) {
          row.status = 'answered';
          row.userAnswer = answer;
          row.answerSource = provenance?.source ?? 'user';
          row.answeredByAgentId = provenance?.agentId;
        }
      },
    ),
    markOpenQuestionAnswersDelivered: vi.fn(async () => undefined),
    invokeAgentList: vi.fn(async () => [] as ReadonlyArray<Agent>),
    invokeAgentUpdateStatus: vi.fn(async () => undefined),
    removeQuestionsFromSlot: vi.fn(async () => false),
  };
});

vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return { ...actual, removeQuestionsFromSlot: h.removeQuestionsFromSlot };
});

vi.mock('@goodboy/db', () => ({
  getOpenQuestionById: h.getOpenQuestionById,
  markOpenQuestionAnswered: h.markOpenQuestionAnswered,
  markOpenQuestionAnswersDelivered: h.markOpenQuestionAnswersDelivered,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: h.invokeAgentList,
  invokeAgentUpdateStatus: h.invokeAgentUpdateStatus,
}));

import { resolveQuestionDelegate, resetQuestionDelegateNudges } from './resolveQuestionDelegate';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;
const ASKER_ID = 'asker-1' as AgentId;
const CHILD_ID = 'child-1' as AgentId;
const QUESTION_ID = 'oq-1' as OpenQuestionId;

const child: Agent = {
  id: CHILD_ID,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'answer: pick a database',
  status: 'running',
  kind: 'scout',
  sourceKind: 'open_question',
  sourceThreadId: QUESTION_ID,
  parentAgentId: ASKER_ID,
} as unknown as Agent;

const toQuestion = (row: Row): OpenQuestion =>
  ({
    id: row.id as OpenQuestionId,
    sessionId: SESSION_ID,
    text: row.text,
    suggestedAnswers: [],
    createdByAgentId: row.createdByAgentId as AgentId | undefined,
    userAnswer: row.userAnswer,
    answerSource: row.answerSource,
    answeredByAgentId: row.answeredByAgentId as AgentId | undefined,
    answerDeliveredAt: row.answerDeliveredAt,
    status: row.status,
    createdAt: '2026-09-21T00:00:00.000Z',
  }) as unknown as OpenQuestion;

type Harness = {
  readonly state: Record<string, unknown> & {
    sessionOpenQuestions: Record<string, ReadonlyArray<OpenQuestion>>;
    sessionAnsweredQuestions: Record<string, ReadonlyArray<OpenQuestion>>;
    sendTurn: ReturnType<typeof vi.fn>;
    emitNotification: ReturnType<typeof vi.fn>;
  };
  readonly run: ReturnType<typeof resolveQuestionDelegate>;
};

const createHarness = (): Harness => {
  const state = {
    sessionPhaseRuns: { [SESSION_ID]: [child] as ReadonlyArray<Agent> },
    sessionOpenQuestions: {} as Record<string, ReadonlyArray<OpenQuestion>>,
    sessionAnsweredQuestions: {} as Record<string, ReadonlyArray<OpenQuestion>>,
    loadSessionOpenQuestions: vi.fn(async () => {
      state.sessionOpenQuestions = {
        [SESSION_ID]: h.rows.filter((row) => row.status === 'open').map(toQuestion),
      };
    }),
    loadSessionAnsweredQuestions: vi.fn(async () => {
      state.sessionAnsweredQuestions = {
        [SESSION_ID]: h.rows.filter((row) => row.status === 'answered').map(toQuestion),
      };
    }),
    loadSessionSlots: vi.fn(async () => undefined),
    refreshUnreadWorkspaces: vi.fn(() => undefined),
    sendTurn: vi.fn(async () => undefined),
    emitNotification: vi.fn(async () => undefined),
  };
  const set = ((update: unknown) => {
    const patch = typeof update === 'function' ? (update as (s: unknown) => object)(state) : update;
    Object.assign(state, patch);
  }) as SetFn;
  const get = (() => state) as unknown as GetFn;
  return { state, run: resolveQuestionDelegate(set, get) };
};

const seed = (seeded: ReadonlyArray<Row>): void => {
  h.rows.splice(0, h.rows.length, ...seeded.map((row) => ({ ...row })));
};

beforeEach(() => {
  vi.clearAllMocks();
  resetQuestionDelegateNudges();
  seed([
    {
      id: QUESTION_ID,
      text: 'pick a database',
      createdByAgentId: ASKER_ID,
      status: 'open',
      userAnswer: null,
    },
  ]);
});

const statusOf = (agentId: AgentId): string | undefined => {
  const call = h.invokeAgentUpdateStatus.mock.calls.find(
    (entry) => (entry as ReadonlyArray<unknown>)[0] === agentId,
  ) as ReadonlyArray<unknown> | undefined;
  return (call?.[1] as { status?: string } | undefined)?.status;
};

const answerTurn = (state: Harness['state']) =>
  state.sendTurn.mock.calls
    .map(([turn]) => turn as { agentId?: string; content: string })
    .find((turn) => turn.agentId === ASKER_ID);

describe('resolveQuestionDelegate', () => {
  it('writes the answer as the user own, with agent provenance, and wakes the asker', async () => {
    const { state, run } = createHarness();

    await run({
      sessionId: SESSION_ID,
      agentId: CHILD_ID,
      assistantText:
        'looked around\n<<oq-answer>>Postgres, the migration path is shorter<</oq-answer>>',
    });

    expect(h.markOpenQuestionAnswered).toHaveBeenCalledWith(
      {},
      QUESTION_ID,
      'Postgres, the migration path is shorter',
      { source: 'agent', agentId: CHILD_ID },
    );
    expect(h.rows[0]).toMatchObject({ status: 'answered', answerSource: 'agent' });
    expect(statusOf(CHILD_ID)).toBe('completed');

    const turn = answerTurn(state);
    expect(turn?.content).toContain('Postgres, the migration path is shorter');
    expect(turn?.content).toContain("an agent answered this on the user's behalf");
  });

  it('leaves the child running when it asked the human instead of answering', async () => {
    const { state, run } = createHarness();

    await run({
      sessionId: SESSION_ID,
      agentId: CHILD_ID,
      assistantText:
        '<<ctx-question suggestions="one|two">>which region hosts the primary?<</ctx-question>>',
    });

    expect(h.invokeAgentUpdateStatus).not.toHaveBeenCalled();
    expect(h.markOpenQuestionAnswered).not.toHaveBeenCalled();
    expect(answerTurn(state)).toBeUndefined();
    expect(h.rows[0]?.status).toBe('open');
  });

  it('nudges once for a reply with no block, then fails the child and keeps the question open', async () => {
    const { state, run } = createHarness();

    await run({ sessionId: SESSION_ID, agentId: CHILD_ID, assistantText: 'here is some prose' });

    expect(state.sendTurn).toHaveBeenCalledTimes(1);
    expect(
      (state.sendTurn.mock.calls[0]?.[0] as { agentId?: string; content: string }).agentId,
    ).toBe(CHILD_ID);
    expect(h.invokeAgentUpdateStatus).not.toHaveBeenCalled();

    await run({ sessionId: SESSION_ID, agentId: CHILD_ID, assistantText: 'still prose' });

    expect(state.sendTurn).toHaveBeenCalledTimes(1);
    expect(statusOf(CHILD_ID)).toBe('failed');
    expect(h.rows[0]?.status).toBe('open');
    expect(state.emitNotification).toHaveBeenCalled();
  });

  it('records the answer and wakes nobody when no agent asked the question', async () => {
    seed([{ id: QUESTION_ID, text: 'pick a database', status: 'open', userAnswer: null }]);
    const { state, run } = createHarness();

    await run({
      sessionId: SESSION_ID,
      agentId: CHILD_ID,
      assistantText: '<<oq-answer>>Postgres<</oq-answer>>',
    });

    expect(h.markOpenQuestionAnswered).toHaveBeenCalledWith({}, QUESTION_ID, 'Postgres', {
      source: 'agent',
      agentId: CHILD_ID,
    });
    expect(statusOf(CHILD_ID)).toBe('completed');
    expect(state.sendTurn).not.toHaveBeenCalled();
  });

  it('skips the child when the question was already answered by hand', async () => {
    seed([
      {
        id: QUESTION_ID,
        text: 'pick a database',
        createdByAgentId: ASKER_ID,
        status: 'answered',
        userAnswer: 'SQLite',
      },
    ]);
    const { state, run } = createHarness();

    await run({
      sessionId: SESSION_ID,
      agentId: CHILD_ID,
      assistantText: '<<oq-answer>>Postgres<</oq-answer>>',
    });

    expect(statusOf(CHILD_ID)).toBe('skipped');
    expect(h.markOpenQuestionAnswered).not.toHaveBeenCalled();
    expect(answerTurn(state)).toBeUndefined();
    expect(h.rows[0]?.userAnswer).toBe('SQLite');
  });
});
