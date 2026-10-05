// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { OpenQuestion } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    answerOpenQuestions: vi.fn(async () => undefined),
    dismissOpenQuestion: vi.fn(async () => undefined),
    sendQuestionAsMessage: vi.fn(async () => undefined),
    navigate: vi.fn(),
    loadAgentTranscript: vi.fn(async () => undefined),
    spawnQuestionDelegates: vi.fn(
      async ({ requests }: { requests: ReadonlyArray<{ question: { id: string } }> }) =>
        requests.map((request) => ({
          questionId: request.question.id,
          agentId: 'child-1',
          kind: 'spawned' as const,
        })),
    ),
    sessionPhaseRuns: {
      'sess-1': [
        { id: 'agent-1', name: 'scout', status: 'completed' },
        { id: 'agent-2', name: 'implementer', status: 'running' },
      ],
    } as Record<string, ReadonlyArray<unknown>>,
    sessionWorkflows: {} as Record<string, ReadonlyArray<unknown>>,
    providers: [] as ReadonlyArray<unknown>,
    cliRequirements: [] as ReadonlyArray<unknown>,
  },
}));

const { openInStore } = vi.hoisted(() => ({ openInStore: { questions: [] as unknown[] } }));

vi.mock('../../../../store', async () => ({
  ...(await import('../../../../store/slices/navigation/place')),
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessionOpenQuestions: () => openInStore.questions,
}));

import { OpenQuestionCluster } from './OpenQuestionCluster';
import { useOpenQuestions } from '../../../context/components/QuestionsTab/useOpenQuestions';

const makeQuestion = (
  overrides: { id: string; text: string } & Partial<Record<keyof OpenQuestion, unknown>>,
): OpenQuestion =>
  ({
    sessionId: 'sess-1',
    suggestedAnswers: [],
    userAnswer: null,
    status: 'open',
    isBlocking: false,
    createdByAgentId: 'agent-1',
    turnOrdinal: 1,
    createdAt: '2026-06-13T00:00:00.000Z',
    ...overrides,
  }) as unknown as OpenQuestion;

const dbQuestion = makeQuestion({
  id: 'oq-1',
  text: 'Use Postgres or SQLite?',
  suggestedAnswers: ['Postgres', 'SQLite'],
});

const cacheQuestion = makeQuestion({
  id: 'oq-2',
  text: 'Redis or Memcached?',
  suggestedAnswers: ['Redis', 'Memcached'],
});

const deployQuestion = makeQuestion({
  id: 'oq-3',
  text: 'Fly or Render?',
  suggestedAnswers: ['Fly', 'Render'],
});

const BASE_RUNS: ReadonlyArray<unknown> = [
  { id: 'agent-1', name: 'scout', status: 'completed' },
  { id: 'agent-2', name: 'implementer', status: 'running' },
];

const renderCluster = (questions: ReadonlyArray<OpenQuestion>) => {
  openInStore.questions = questions.filter((question) => question.status === 'open');
  render(<OpenQuestionCluster questions={questions} sessionId={'sess-1' as never} />);
};

const answerButton = () => screen.getByRole('button', { name: 'Answer' });

beforeEach(() => {
  state.sessionPhaseRuns['sess-1'] = BASE_RUNS;
  state.answerOpenQuestions.mockClear();
  state.dismissOpenQuestion.mockClear();
  state.sendQuestionAsMessage.mockClear();
  state.navigate.mockClear();
  state.spawnQuestionDelegates.mockClear();
  useOpenQuestions.setState({ drafts: {}, staged: [], pendingUndo: null });
});
afterEach(cleanup);

describe('OpenQuestionCluster', () => {
  it('shows one question at a time with who asks and where it stands', () => {
    renderCluster([dbQuestion, cacheQuestion]);
    screen.getByRole('heading', { name: 'Use Postgres or SQLite?' });
    expect(screen.queryByRole('heading', { name: 'Redis or Memcached?' })).toBeNull();
    screen.getByText('scout');
    screen.getByText('1 of 2');
  });

  it('stages the first answer and moves on without reaching the store', () => {
    renderCluster([dbQuestion, cacheQuestion]);
    fireEvent.click(screen.getByRole('radio', { name: 'Postgres' }));
    fireEvent.click(answerButton());
    screen.getByRole('heading', { name: 'Redis or Memcached?' });
    expect(state.answerOpenQuestions).not.toHaveBeenCalled();
  });

  it('sends every answer of the agent together after the last one', async () => {
    renderCluster([dbQuestion, cacheQuestion]);
    fireEvent.click(screen.getByRole('radio', { name: 'Postgres' }));
    fireEvent.click(answerButton());
    fireEvent.click(screen.getByRole('radio', { name: 'Redis' }));
    fireEvent.click(answerButton());
    await waitFor(() =>
      expect(state.answerOpenQuestions).toHaveBeenCalledWith(
        'sess-1',
        [
          { id: 'oq-1', text: 'Use Postgres or SQLite?', answer: 'Postgres' },
          { id: 'oq-2', text: 'Redis or Memcached?', answer: 'Redis' },
        ],
        'agent-1',
      ),
    );
  });

  it('answers with the number key and Enter', async () => {
    renderCluster([dbQuestion]);
    const card = screen.getByRole('article');
    fireEvent.keyDown(card, { key: '2' });
    fireEvent.keyDown(card, { key: 'Enter' });
    await waitFor(() =>
      expect(state.answerOpenQuestions).toHaveBeenCalledWith(
        'sess-1',
        [{ id: 'oq-1', text: 'Use Postgres or SQLite?', answer: 'SQLite' }],
        'agent-1',
      ),
    );
  });

  it('pages back to a staged answer and undoes it', () => {
    renderCluster([dbQuestion, cacheQuestion]);
    fireEvent.click(screen.getByRole('radio', { name: 'Postgres' }));
    fireEvent.click(answerButton());
    fireEvent.click(screen.getByRole('button', { name: 'Previous question' }));
    screen.getByText('Answered · sends with the rest');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(useOpenQuestions.getState().staged).toEqual([]);
  });

  it('skips to the next question without answering', () => {
    renderCluster([dbQuestion, cacheQuestion, deployQuestion]);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    screen.getByRole('heading', { name: 'Redis or Memcached?' });
  });

  it('joins the picks and the written answer of a multiple choice', async () => {
    const multi = makeQuestion({
      id: 'oq-4',
      text: 'Which events should be retried?',
      suggestedAnswers: ['payment.succeeded', 'refund.created'],
      selectMode: 'many',
    });
    renderCluster([multi]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'payment.succeeded' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Something else' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), {
      target: { value: 'payout.paid' },
    });
    fireEvent.click(answerButton());
    await waitFor(() =>
      expect(state.answerOpenQuestions).toHaveBeenCalledWith(
        'sess-1',
        [
          {
            id: 'oq-4',
            text: 'Which events should be retried?',
            answer: 'payment.succeeded, payout.paid',
          },
        ],
        'agent-1',
      ),
    );
  });

  it('keeps an answered question as a collapsed record', () => {
    renderCluster([
      makeQuestion({ id: 'oq-9', text: 'Old question?', status: 'answered', userAnswer: 'yes' }),
      dbQuestion,
    ]);
    screen.getByText('answered');
    screen.getByRole('heading', { name: 'Use Postgres or SQLite?' });
  });

  it('dismisses a question that does not block', () => {
    renderCluster([dbQuestion]);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss question' }));
    expect(state.dismissOpenQuestion).toHaveBeenCalledWith('sess-1', dbQuestion);
  });
});

describe('OpenQuestionCluster, a blocking question the agent asked in prose', () => {
  const proseQuestion = makeQuestion({
    id: 'oq-prose',
    text: 'Confermi il push? Dopo apro la PR.',
    isBlocking: true,
  });
  const yesNoQuestion = makeQuestion({
    id: 'oq-yes-no',
    text: 'Shall I push the branch now?',
    isBlocking: true,
  });
  const typeReply = (value: string) =>
    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value } });

  it('cannot be discarded, but its reply can go as a plain message that closes it', async () => {
    renderCluster([proseQuestion]);
    expect(screen.queryByRole('button', { name: 'Dismiss question' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Send as message' }).hasAttribute('disabled')).toBe(
      true,
    );
    typeReply('Not that one, I left a note on a line of the diff.');
    fireEvent.click(screen.getByRole('button', { name: 'Send as message' }));
    await waitFor(() =>
      expect(state.sendQuestionAsMessage).toHaveBeenCalledWith({
        sessionId: 'sess-1',
        question: proseQuestion,
        text: 'Not that one, I left a note on a line of the diff.',
      }),
    );
    expect(state.answerOpenQuestions).not.toHaveBeenCalled();
    expect(useOpenQuestions.getState().drafts['oq-prose']).toBeUndefined();
  });

  it('still answers as an answer from the same field', async () => {
    renderCluster([proseQuestion]);
    typeReply('Yes, push it.');
    fireEvent.click(answerButton());
    await waitFor(() =>
      expect(state.answerOpenQuestions).toHaveBeenCalledWith(
        'sess-1',
        [{ id: 'oq-prose', text: proseQuestion.text, answer: 'Yes, push it.' }],
        'agent-1',
      ),
    );
    expect(state.sendQuestionAsMessage).not.toHaveBeenCalled();
  });

  it('sends what is written under Something else as a plain message too', async () => {
    renderCluster([yesNoQuestion]);
    fireEvent.click(screen.getByRole('radio', { name: 'Something else' }));
    typeReply('Wait for the review first.');
    fireEvent.click(screen.getByRole('button', { name: 'Send as message' }));
    await waitFor(() =>
      expect(state.sendQuestionAsMessage).toHaveBeenCalledWith({
        sessionId: 'sess-1',
        question: yesNoQuestion,
        text: 'Wait for the review first.',
      }),
    );
  });

  it('offers no plain message on a question that does not block', () => {
    renderCluster([dbQuestion]);
    expect(screen.queryByRole('button', { name: 'Send as message' })).toBeNull();
  });
});

describe('OpenQuestionCluster delegation', () => {
  const chooseDelegate = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Let an agent decide' }));

  it('spawns nothing while the choice is only staged', () => {
    renderCluster([dbQuestion]);
    chooseDelegate();
    expect(state.spawnQuestionDelegates).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Hand off' }).hasAttribute('disabled')).toBe(false);
  });

  it('spawns the delegate on Hand off, carrying the hints the user wrote', () => {
    renderCluster([dbQuestion]);
    chooseDelegate();
    fireEvent.change(screen.getByLabelText('Hints for the delegated agent'), {
      target: { value: 'weigh the migration cost' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hand off' }));
    const call = state.spawnQuestionDelegates.mock.calls[0]?.[0] as {
      requests: ReadonlyArray<{ question: { id: string }; hints: string; model: string }>;
    };
    expect(call.requests.map((request) => request.question.id)).toEqual(['oq-1']);
    expect(call.requests[0]?.hints).toBe('weigh the migration cost');
  });

  it('pulls a question with a live delegate aside and waits on it', () => {
    state.sessionPhaseRuns['sess-1'] = [
      ...BASE_RUNS,
      {
        id: 'delegate-1',
        name: 'answer: Use Postgres or SQLite?',
        status: 'running',
        ordinal: 5,
        sourceKind: 'open_question',
        sourceThreadId: 'oq-1',
      },
    ];
    renderCluster([dbQuestion, cacheQuestion]);
    screen.getByTestId('delegate-waiting-row');
    screen.getByRole('radio', { name: 'Redis' });
    fireEvent.click(screen.getByTestId('delegate-waiting-row'));
    expect(state.navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: 'sess-1', agentId: 'delegate-1' },
    });
  });
});
