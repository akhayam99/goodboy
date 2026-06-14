import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';

const { markOpenQuestionAnswered, removeQuestionsFromSlot } = vi.hoisted(() => ({
  markOpenQuestionAnswered: vi.fn(async () => undefined),
  removeQuestionsFromSlot: vi.fn(async () => false),
}));

vi.mock('@goodboy/db', () => ({ markOpenQuestionAnswered }));
vi.mock('@goodboy/core', () => ({ removeQuestionsFromSlot }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { answerOpenQuestions } from './answerOpenQuestions';

const deps = {
  loadSessionOpenQuestions: vi.fn(async () => undefined),
  loadSessionAnsweredQuestions: vi.fn(async () => undefined),
  loadSessionSlots: vi.fn(async () => undefined),
  sendTurn: vi.fn(
    async (_turn: { sessionId: SessionId; content: string; agentId?: string }) => undefined,
  ),
};

const get = (() => deps) as never;
const run = answerOpenQuestions(get);
const sessionId = 'sess-1' as SessionId;

beforeEach(() => {
  vi.clearAllMocks();
  removeQuestionsFromSlot.mockResolvedValue(false);
});
afterEach(() => vi.restoreAllMocks());

describe('answerOpenQuestions', () => {
  it('marks every pair answered and sends a single combined turn', async () => {
    await run(
      sessionId,
      [
        { id: 'oq-1' as never, text: 'Q1?', answer: 'A1' },
        { id: 'oq-2' as never, text: 'Q2?', answer: 'A2' },
      ],
      'agent-1' as AgentId,
    );

    expect(markOpenQuestionAnswered).toHaveBeenCalledTimes(2);
    expect(markOpenQuestionAnswered).toHaveBeenCalledWith(expect.anything(), 'oq-1', 'A1');
    expect(markOpenQuestionAnswered).toHaveBeenCalledWith(expect.anything(), 'oq-2', 'A2');

    expect(removeQuestionsFromSlot).toHaveBeenCalledTimes(1);
    expect(removeQuestionsFromSlot).toHaveBeenCalledWith(expect.anything(), sessionId, [
      'Q1?',
      'Q2?',
    ]);

    expect(deps.sendTurn).toHaveBeenCalledTimes(1);
    const turn = deps.sendTurn.mock.calls[0]![0] as {
      sessionId: SessionId;
      content: string;
      agentId?: string;
    };
    expect(turn.sessionId).toBe(sessionId);
    expect(turn.agentId).toBe('agent-1');
    expect(turn.content).toContain('Q: Q1?');
    expect(turn.content).toContain('A: A1');
    expect(turn.content).toContain('Q: Q2?');
    expect(turn.content).toContain('A: A2');
  });

  it('drops empty and whitespace-only answers before marking or sending', async () => {
    await run(
      sessionId,
      [
        { id: 'oq-1' as never, text: 'Q1?', answer: '   ' },
        { id: 'oq-2' as never, text: 'Q2?', answer: 'A2' },
        { id: 'oq-3' as never, text: 'Q3?', answer: '' },
      ],
      'agent-1' as AgentId,
    );

    expect(markOpenQuestionAnswered).toHaveBeenCalledTimes(1);
    expect(markOpenQuestionAnswered).toHaveBeenCalledWith(expect.anything(), 'oq-2', 'A2');
    expect(removeQuestionsFromSlot).toHaveBeenCalledWith(expect.anything(), sessionId, ['Q2?']);
    expect(deps.sendTurn).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when no answer has content', async () => {
    await run(
      sessionId,
      [
        { id: 'oq-1' as never, text: 'Q1?', answer: '' },
        { id: 'oq-2' as never, text: 'Q2?', answer: '  ' },
      ],
      'agent-1' as AgentId,
    );

    expect(markOpenQuestionAnswered).not.toHaveBeenCalled();
    expect(removeQuestionsFromSlot).not.toHaveBeenCalled();
    expect(deps.sendTurn).not.toHaveBeenCalled();
    expect(deps.loadSessionOpenQuestions).not.toHaveBeenCalled();
  });

  it('reloads slots only when the slot actually changed', async () => {
    removeQuestionsFromSlot.mockResolvedValueOnce(true);
    await run(sessionId, [{ id: 'oq-1' as never, text: 'Q1?', answer: 'A1' }], null);
    expect(deps.loadSessionSlots).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    removeQuestionsFromSlot.mockResolvedValue(false);
    await run(sessionId, [{ id: 'oq-1' as never, text: 'Q1?', answer: 'A1' }], null);
    expect(deps.loadSessionSlots).not.toHaveBeenCalled();
  });

  it('passes agentId undefined when no target agent is given', async () => {
    await run(sessionId, [{ id: 'oq-1' as never, text: 'Q1?', answer: 'A1' }], null);
    const turn = deps.sendTurn.mock.calls[0]![0] as { agentId?: string };
    expect(turn.agentId).toBeUndefined();
  });
});
