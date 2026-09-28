// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { AgentId, OpenQuestion, OpenQuestionId, SessionId } from '@goodboy/types';

const answerOpenQuestions = vi.fn().mockResolvedValue(undefined);
const spawnQuestionDelegates = vi.fn().mockResolvedValue([]);
let openQuestions: ReadonlyArray<OpenQuestion> = [];

vi.mock('../../../../store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({ sessionPhaseRuns: {}, answerOpenQuestions, spawnQuestionDelegates }),
  useSessionOpenQuestions: () => openQuestions,
}));

import { useOpenQuestions } from '../../components/QuestionsTab/useOpenQuestions';
import { useAnswerQuestion } from '.';

const SESSION = 'session-1' as SessionId;

const question = ({ id, askerId }: { readonly id: string; readonly askerId: string }) =>
  ({
    id: id as OpenQuestionId,
    sessionId: SESSION,
    createdByAgentId: askerId as AgentId,
    text: `question ${id}`,
    suggestedAnswers: ['a', 'b'],
    isBlocking: false,
    userAnswer: null,
    status: 'open',
    createdAt: '2026-09-28T10:00:00.000Z',
  }) as unknown as OpenQuestion;

const Q1 = question({ id: 'q1', askerId: 'planner' });
const Q2 = question({ id: 'q2', askerId: 'planner' });
const Q3 = question({ id: 'q3', askerId: 'reviewer' });

beforeEach(() => {
  answerOpenQuestions.mockClear();
  spawnQuestionDelegates.mockClear();
  openQuestions = [Q1, Q2, Q3];
  useOpenQuestions.setState({ drafts: {}, staged: [], pendingUndo: null });
});

describe('useAnswerQuestion', () => {
  it('stages an answer while the same agent still has an open question', async () => {
    useOpenQuestions.getState().toggleSuggestion(Q1.id, 'a');
    const { result } = renderHook(() => useAnswerQuestion({ sessionId: SESSION }));
    await act(() => result.current.answer(Q1));
    expect(useOpenQuestions.getState().staged).toEqual([Q1.id]);
    expect(answerOpenQuestions).not.toHaveBeenCalled();
  });

  it('sends every answer of the agent together after the last one', async () => {
    useOpenQuestions.getState().toggleSuggestion(Q1.id, 'a');
    useOpenQuestions.getState().toggleSuggestion(Q2.id, 'b');
    const { result } = renderHook(() => useAnswerQuestion({ sessionId: SESSION }));
    await act(() => result.current.answer(Q1));
    await act(() => result.current.answer(Q2));
    expect(answerOpenQuestions).toHaveBeenCalledWith(
      SESSION,
      [
        { id: Q1.id, text: Q1.text, answer: 'a' },
        { id: Q2.id, text: Q2.text, answer: 'b' },
      ],
      'planner',
    );
    expect(useOpenQuestions.getState().staged).toEqual([]);
  });

  it('sends a lone question of another agent at once', async () => {
    useOpenQuestions.getState().toggleSuggestion(Q3.id, 'a');
    const { result } = renderHook(() => useAnswerQuestion({ sessionId: SESSION }));
    await act(() => result.current.answer(Q3));
    expect(answerOpenQuestions).toHaveBeenCalledOnce();
  });

  it('ignores a question with nothing picked', async () => {
    const { result } = renderHook(() => useAnswerQuestion({ sessionId: SESSION }));
    await act(() => result.current.answer(Q3));
    expect(useOpenQuestions.getState().staged).toEqual([]);
  });

  it('hands a delegated question to an agent with the batch', async () => {
    useOpenQuestions.getState().setAnswerIntent(Q3.id, {
      kind: 'agent',
      hints: 'weigh the cost',
      routing: { provider: 'anthropic', model: 'sonnet-5', effort: 'medium' },
    });
    const { result } = renderHook(() => useAnswerQuestion({ sessionId: SESSION }));
    await act(() => result.current.answer(Q3));
    expect(spawnQuestionDelegates).toHaveBeenCalledWith({
      sessionId: SESSION,
      requests: [
        {
          question: Q3,
          hints: 'weigh the cost',
          provider: 'anthropic',
          model: 'sonnet-5',
          effort: 'medium',
        },
      ],
    });
  });

  it('takes a staged answer back on undo', async () => {
    useOpenQuestions.getState().toggleSuggestion(Q1.id, 'a');
    const { result } = renderHook(() => useAnswerQuestion({ sessionId: SESSION }));
    await act(() => result.current.answer(Q1));
    act(() => result.current.undo(Q1.id));
    expect(useOpenQuestions.getState().staged).toEqual([]);
  });
});
