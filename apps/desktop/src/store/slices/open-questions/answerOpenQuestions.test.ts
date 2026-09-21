import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, OpenQuestion, OpenQuestionId, SessionId } from '@goodboy/types';

type Row = {
  id: string;
  text: string;
  createdByAgentId?: string;
  status: 'open' | 'answered' | 'dismissed';
  userAnswer: string | null;
  answerDeliveredAt?: string;
};

const {
  rows,
  markOpenQuestionAnswered,
  markOpenQuestionAnswersDelivered,
  markOpenQuestionDismissed,
  removeQuestionsFromSlot,
  invokeAgentList,
  invokeAgentUpdateStatus,
} = vi.hoisted(() => {
  const rows: Row[] = [];
  return {
    rows,
    markOpenQuestionAnswered: vi.fn(async (_db: unknown, id: string, answer: string) => {
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.status = 'answered';
        row.userAnswer = answer;
      }
    }),
    markOpenQuestionAnswersDelivered: vi.fn(
      async ({ ids }: { db: unknown; ids: ReadonlyArray<string> }) => {
        for (const id of ids) {
          const row = rows.find((r) => r.id === id);
          if (row) {
            row.answerDeliveredAt = '2026-09-21T00:00:00.000Z';
          }
        }
      },
    ),
    markOpenQuestionDismissed: vi.fn(async (_db: unknown, id: string) => {
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.status = 'dismissed';
      }
    }),
    removeQuestionsFromSlot: vi.fn(async () => false),
    invokeAgentList: vi.fn(async () => []),
    invokeAgentUpdateStatus: vi.fn(async () => undefined),
  };
});

vi.mock('@goodboy/db', () => ({
  markOpenQuestionAnswered,
  markOpenQuestionAnswersDelivered,
  markOpenQuestionDismissed,
}));
vi.mock('@goodboy/core', () => ({
  removeQuestionsFromSlot,
  wrapOpenQuestionAnswers: (body: string) => `<<oq-answers>>\n${body}\n<</oq-answers>>`,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList,
  invokeAgentUpdateStatus,
}));

import { answerOpenQuestions } from './answerOpenQuestions';

const sessionId = 'sess-1' as SessionId;

const toQuestion = (row: Row): OpenQuestion =>
  ({
    id: row.id as OpenQuestionId,
    sessionId,
    text: row.text,
    suggestedAnswers: [],
    createdByAgentId: row.createdByAgentId as AgentId | undefined,
    userAnswer: row.userAnswer,
    status: row.status,
    answerDeliveredAt: row.answerDeliveredAt,
    createdAt: '2026-09-20T00:00:00.000Z',
  }) as unknown as OpenQuestion;

const deps = {
  sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
  cancelCurrentTurn: vi.fn(async () => undefined),
  loadSessionDismissedQuestions: vi.fn(async () => undefined),
  sessionOpenQuestions: {} as Record<string, ReadonlyArray<OpenQuestion>>,
  sessionAnsweredQuestions: {} as Record<string, ReadonlyArray<OpenQuestion>>,
  loadSessionOpenQuestions: vi.fn(async () => {
    deps.sessionOpenQuestions = {
      [sessionId]: rows.filter((r) => r.status === 'open').map(toQuestion),
    };
  }),
  loadSessionAnsweredQuestions: vi.fn(async () => {
    deps.sessionAnsweredQuestions = {
      [sessionId]: rows.filter((r) => r.status === 'answered').map(toQuestion),
    };
  }),
  loadSessionSlots: vi.fn(async () => undefined),
  sendTurn: vi.fn(
    async (_turn: { sessionId: SessionId; content: string; agentId?: string }) => undefined,
  ),
};

const get = (() => deps) as never;
const set = ((update: unknown) => {
  const patch = typeof update === 'function' ? (update as (s: unknown) => object)(deps) : update;
  Object.assign(deps, patch);
}) as never;
const run = answerOpenQuestions(set, get);

const seed = async (seeded: ReadonlyArray<Row>) => {
  rows.splice(0, rows.length, ...seeded.map((row) => ({ ...row })));
  await deps.loadSessionOpenQuestions();
  await deps.loadSessionAnsweredQuestions();
  vi.clearAllMocks();
};

const lastTurn = () =>
  deps.sendTurn.mock.calls.at(-1)?.[0] as {
    sessionId: SessionId;
    content: string;
    agentId?: string;
  };

beforeEach(() => {
  vi.clearAllMocks();
  removeQuestionsFromSlot.mockResolvedValue(false);
  deps.sessionOpenQuestions = {};
  deps.sessionAnsweredQuestions = {};
  deps.sessionPhaseRuns = {};
});
afterEach(() => vi.restoreAllMocks());

describe('answerOpenQuestions', () => {
  it('sends one turn carrying the answer when it was the agent last open question', async () => {
    await seed([
      { id: 'oq-1', text: 'Q1?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
    ]);

    await run(
      sessionId,
      [{ id: 'oq-1' as OpenQuestionId, text: 'Q1?', answer: 'A1' }],
      'agent-1' as AgentId,
    );

    expect(markOpenQuestionAnswered).toHaveBeenCalledWith(expect.anything(), 'oq-1', 'A1');
    expect(deps.sendTurn).toHaveBeenCalledTimes(1);
    expect(lastTurn().agentId).toBe('agent-1');
    expect(lastTurn().content).toContain('Q: Q1?');
    expect(lastTurn().content).toContain('A: A1');
  });

  it('persists and sends nothing while the agent still has an open question', async () => {
    await seed([
      { id: 'oq-1', text: 'Q1?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
      { id: 'oq-2', text: 'Q2?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
    ]);

    await run(
      sessionId,
      [{ id: 'oq-1' as OpenQuestionId, text: 'Q1?', answer: 'A1' }],
      'agent-1' as AgentId,
    );

    expect(markOpenQuestionAnswered).toHaveBeenCalledWith(expect.anything(), 'oq-1', 'A1');
    expect(deps.sendTurn).not.toHaveBeenCalled();
    expect(markOpenQuestionAnswersDelivered).not.toHaveBeenCalled();
  });

  it('carries every staged answer when the last question of the agent is answered', async () => {
    await seed([
      { id: 'oq-1', text: 'Q1?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
      { id: 'oq-2', text: 'Q2?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
    ]);

    await run(
      sessionId,
      [{ id: 'oq-1' as OpenQuestionId, text: 'Q1?', answer: 'A1' }],
      'agent-1' as AgentId,
    );
    await run(
      sessionId,
      [{ id: 'oq-2' as OpenQuestionId, text: 'Q2?', answer: 'A2' }],
      'agent-1' as AgentId,
    );

    expect(deps.sendTurn).toHaveBeenCalledTimes(1);
    expect(lastTurn().content).toContain('Q: Q1?');
    expect(lastTurn().content).toContain('A: A1');
    expect(lastTurn().content).toContain('Q: Q2?');
    expect(lastTurn().content).toContain('A: A2');
  });

  it('never sends an answer twice once it has been delivered', async () => {
    await seed([
      { id: 'oq-1', text: 'Q1?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
    ]);

    await run(
      sessionId,
      [{ id: 'oq-1' as OpenQuestionId, text: 'Q1?', answer: 'A1' }],
      'agent-1' as AgentId,
    );
    expect(markOpenQuestionAnswersDelivered).toHaveBeenCalledWith({
      db: expect.anything(),
      ids: ['oq-1'],
    });

    rows.push({
      id: 'oq-2',
      text: 'Q2?',
      createdByAgentId: 'agent-1',
      status: 'open',
      userAnswer: null,
    });
    await deps.loadSessionOpenQuestions();
    await run(
      sessionId,
      [{ id: 'oq-2' as OpenQuestionId, text: 'Q2?', answer: 'A2' }],
      'agent-1' as AgentId,
    );

    expect(deps.sendTurn).toHaveBeenCalledTimes(2);
    expect(lastTurn().content).toContain('Q: Q2?');
    expect(lastTurn().content).not.toContain('Q: Q1?');
  });

  it('wakes only the agent left with no open question when a submission spans two agents', async () => {
    await seed([
      { id: 'oq-1', text: 'Q1?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
      { id: 'oq-2', text: 'Q2?', createdByAgentId: 'agent-2', status: 'open', userAnswer: null },
      { id: 'oq-3', text: 'Q3?', createdByAgentId: 'agent-2', status: 'open', userAnswer: null },
    ]);

    await run(
      sessionId,
      [
        { id: 'oq-1' as OpenQuestionId, text: 'Q1?', answer: 'A1' },
        { id: 'oq-2' as OpenQuestionId, text: 'Q2?', answer: 'A2' },
      ],
      'agent-1' as AgentId,
    );

    expect(deps.sendTurn).toHaveBeenCalledTimes(1);
    expect(lastTurn().agentId).toBe('agent-1');
    expect(lastTurn().content).toContain('Q: Q1?');
    expect(lastTurn().content).not.toContain('Q: Q2?');
  });

  it('wakes an agent whose remaining question was dismissed rather than answered', async () => {
    await seed([
      { id: 'oq-1', text: 'Q1?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
      {
        id: 'oq-2',
        text: 'Q2?',
        createdByAgentId: 'agent-1',
        status: 'dismissed',
        userAnswer: null,
      },
    ]);

    await run(
      sessionId,
      [{ id: 'oq-1' as OpenQuestionId, text: 'Q1?', answer: 'A1' }],
      'agent-1' as AgentId,
    );

    expect(deps.sendTurn).toHaveBeenCalledTimes(1);
    expect(lastTurn().content).toContain('Q: Q1?');
    expect(lastTurn().content).not.toContain('Q: Q2?');
  });

  it('writes the answer even when the send is skipped', async () => {
    await seed([
      { id: 'oq-1', text: 'Q1?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
      { id: 'oq-2', text: 'Q2?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
    ]);

    await run(
      sessionId,
      [{ id: 'oq-1' as OpenQuestionId, text: 'Q1?', answer: 'A1' }],
      'agent-1' as AgentId,
    );

    expect(deps.sendTurn).not.toHaveBeenCalled();
    expect(rows.find((r) => r.id === 'oq-1')).toMatchObject({
      status: 'answered',
      userAnswer: 'A1',
    });
    expect(deps.sessionAnsweredQuestions[sessionId]?.map((q) => q.id)).toEqual(['oq-1']);
  });

  it('drops empty and whitespace-only answers before marking or sending', async () => {
    await seed([
      { id: 'oq-1', text: 'Q1?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
      { id: 'oq-2', text: 'Q2?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
      { id: 'oq-3', text: 'Q3?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
    ]);

    await run(
      sessionId,
      [
        { id: 'oq-1' as OpenQuestionId, text: 'Q1?', answer: '   ' },
        { id: 'oq-2' as OpenQuestionId, text: 'Q2?', answer: 'A2' },
        { id: 'oq-3' as OpenQuestionId, text: 'Q3?', answer: '' },
      ],
      'agent-1' as AgentId,
    );

    expect(markOpenQuestionAnswered).toHaveBeenCalledTimes(1);
    expect(markOpenQuestionAnswered).toHaveBeenCalledWith(expect.anything(), 'oq-2', 'A2');
    expect(removeQuestionsFromSlot).toHaveBeenCalledWith(expect.anything(), sessionId, ['Q2?']);
    expect(deps.sendTurn).not.toHaveBeenCalled();
  });

  it('is a no-op when no answer has content', async () => {
    await seed([
      { id: 'oq-1', text: 'Q1?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
    ]);

    await run(
      sessionId,
      [
        { id: 'oq-1' as OpenQuestionId, text: 'Q1?', answer: '' },
        { id: 'oq-2' as OpenQuestionId, text: 'Q2?', answer: '  ' },
      ],
      'agent-1' as AgentId,
    );

    expect(markOpenQuestionAnswered).not.toHaveBeenCalled();
    expect(removeQuestionsFromSlot).not.toHaveBeenCalled();
    expect(deps.sendTurn).not.toHaveBeenCalled();
    expect(deps.loadSessionOpenQuestions).not.toHaveBeenCalled();
  });

  it('reloads slots only when the slot actually changed', async () => {
    await seed([
      { id: 'oq-1', text: 'Q1?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
    ]);
    removeQuestionsFromSlot.mockResolvedValueOnce(true);
    await run(
      sessionId,
      [{ id: 'oq-1' as OpenQuestionId, text: 'Q1?', answer: 'A1' }],
      'agent-1' as AgentId,
    );
    expect(deps.loadSessionSlots).toHaveBeenCalledTimes(1);

    await seed([
      { id: 'oq-2', text: 'Q2?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
    ]);
    removeQuestionsFromSlot.mockResolvedValue(false);
    await run(
      sessionId,
      [{ id: 'oq-2' as OpenQuestionId, text: 'Q2?', answer: 'A2' }],
      'agent-1' as AgentId,
    );
    expect(deps.loadSessionSlots).not.toHaveBeenCalled();
  });

  it('wraps the batch prompt in an oq-answers marker so the chat bubble is suppressed', async () => {
    await seed([
      { id: 'oq-1', text: 'Q1?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
    ]);

    await run(
      sessionId,
      [{ id: 'oq-1' as OpenQuestionId, text: 'Q1?', answer: 'A1' }],
      'agent-1' as AgentId,
    );

    expect(lastTurn().content.startsWith('<<oq-answers>>')).toBe(true);
  });

  it('passes agentId undefined for a question no agent asked', async () => {
    await seed([{ id: 'oq-1', text: 'Q1?', status: 'open', userAnswer: null }]);

    await run(sessionId, [{ id: 'oq-1' as OpenQuestionId, text: 'Q1?', answer: 'A1' }], null);

    expect(lastTurn().agentId).toBeUndefined();
  });

  it('cancels and skips the running delegate when the user answers by hand', async () => {
    await seed([
      { id: 'oq-1', text: 'Q1?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
      {
        id: 'oq-child',
        text: 'which region?',
        createdByAgentId: 'child-1',
        status: 'open',
        userAnswer: null,
      },
    ]);
    deps.sessionPhaseRuns = {
      [sessionId]: [
        {
          id: 'child-1',
          sessionId,
          ordinal: 1,
          name: 'answer: Q1?',
          status: 'running',
          sourceKind: 'open_question',
          sourceThreadId: 'oq-1',
          parentAgentId: 'agent-1',
        },
      ],
    };

    await run(
      sessionId,
      [{ id: 'oq-1' as OpenQuestionId, text: 'Q1?', answer: 'A1' }],
      'agent-1' as AgentId,
    );

    expect(deps.cancelCurrentTurn).toHaveBeenCalledWith(sessionId, 'child-1');
    expect(invokeAgentUpdateStatus).toHaveBeenCalledWith(
      'child-1',
      expect.objectContaining({ status: 'skipped' }),
    );
    expect(markOpenQuestionDismissed).toHaveBeenCalledWith(expect.anything(), 'oq-child');
    expect(markOpenQuestionAnswered).toHaveBeenCalledWith(expect.anything(), 'oq-1', 'A1');
  });

  it('leaves a settled delegate alone when the user answers by hand', async () => {
    await seed([
      { id: 'oq-1', text: 'Q1?', createdByAgentId: 'agent-1', status: 'open', userAnswer: null },
    ]);
    deps.sessionPhaseRuns = {
      [sessionId]: [
        {
          id: 'child-1',
          sessionId,
          ordinal: 1,
          name: 'answer: Q1?',
          status: 'failed',
          sourceKind: 'open_question',
          sourceThreadId: 'oq-1',
          parentAgentId: 'agent-1',
        },
      ],
    };

    await run(
      sessionId,
      [{ id: 'oq-1' as OpenQuestionId, text: 'Q1?', answer: 'A1' }],
      'agent-1' as AgentId,
    );

    expect(deps.cancelCurrentTurn).not.toHaveBeenCalled();
    expect(invokeAgentUpdateStatus).not.toHaveBeenCalled();
  });
});
