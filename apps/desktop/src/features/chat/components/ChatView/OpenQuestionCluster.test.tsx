// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { OpenQuestion } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    answerOpenQuestions: vi.fn(async () => undefined),
    dismissOpenQuestion: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
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

beforeEach(() => {
  state.answerOpenQuestions.mockClear();
  state.dismissOpenQuestion.mockClear();
  useOpenQuestions.setState({ drafts: {}, justAnswered: [], pendingUndo: null });
});
afterEach(cleanup);

describe('OpenQuestionCluster', () => {
  it('batches every drafted answer in the cluster into a single submit', async () => {
    render(
      <OpenQuestionCluster questions={[dbQuestion, cacheQuestion]} sessionId={'sess-1' as never} />,
    );

    fireEvent.click(screen.getByText('Postgres'));
    fireEvent.click(screen.getByText('Redis'));

    const submit = await screen.findByText('send 2 answers');
    fireEvent.click(submit);

    expect(state.answerOpenQuestions).toHaveBeenCalledTimes(1);
    expect(state.answerOpenQuestions).toHaveBeenCalledWith(
      'sess-1',
      [
        { id: 'oq-1', text: 'Use Postgres or SQLite?', answer: 'Postgres' },
        { id: 'oq-2', text: 'Redis or Memcached?', answer: 'Redis' },
      ],
      'agent-1',
    );
  });

  it('renders no submit button until at least one answer is drafted', () => {
    render(
      <OpenQuestionCluster questions={[dbQuestion, cacheQuestion]} sessionId={'sess-1' as never} />,
    );

    expect(screen.queryByText('send answer')).toBeNull();
    expect(screen.queryByText(/send \d+ answers/)).toBeNull();
  });

  it('uses the singular label and a single-element batch for one drafted question', async () => {
    render(<OpenQuestionCluster questions={[dbQuestion]} sessionId={'sess-1' as never} />);

    fireEvent.click(screen.getByText('Postgres'));

    const submit = await screen.findByText('send answer');
    fireEvent.click(submit);

    expect(state.answerOpenQuestions).toHaveBeenCalledTimes(1);
    expect(state.answerOpenQuestions).toHaveBeenCalledWith(
      'sess-1',
      [{ id: 'oq-1', text: 'Use Postgres or SQLite?', answer: 'Postgres' }],
      'agent-1',
    );
  });

  it('submits only the drafted question when the cluster is partially filled', async () => {
    render(
      <OpenQuestionCluster questions={[dbQuestion, cacheQuestion]} sessionId={'sess-1' as never} />,
    );

    fireEvent.click(screen.getByText('Redis'));

    const submit = await screen.findByText('send answer');
    fireEvent.click(submit);

    expect(state.answerOpenQuestions).toHaveBeenCalledTimes(1);
    expect(state.answerOpenQuestions).toHaveBeenCalledWith(
      'sess-1',
      [{ id: 'oq-2', text: 'Redis or Memcached?', answer: 'Redis' }],
      'agent-1',
    );
  });

  it('excludes already-answered questions from the batch', async () => {
    const answered = makeQuestion({
      id: 'oq-1',
      text: 'Use Postgres or SQLite?',
      suggestedAnswers: ['Postgres', 'SQLite'],
      status: 'answered',
      userAnswer: 'Postgres',
    });

    render(
      <OpenQuestionCluster questions={[answered, cacheQuestion]} sessionId={'sess-1' as never} />,
    );

    fireEvent.click(screen.getByText('Redis'));

    const submit = await screen.findByText('send answer');
    fireEvent.click(submit);

    expect(state.answerOpenQuestions).toHaveBeenCalledWith(
      'sess-1',
      [{ id: 'oq-2', text: 'Redis or Memcached?', answer: 'Redis' }],
      'agent-1',
    );
  });

  it('shows no submit button when every question is already answered', () => {
    const a1 = makeQuestion({
      id: 'oq-1',
      text: 'Use Postgres or SQLite?',
      status: 'answered',
      userAnswer: 'Postgres',
    });
    const a2 = makeQuestion({
      id: 'oq-2',
      text: 'Redis or Memcached?',
      status: 'answered',
      userAnswer: 'Redis',
    });

    render(<OpenQuestionCluster questions={[a1, a2]} sessionId={'sess-1' as never} />);

    expect(screen.queryByText('send answer')).toBeNull();
    expect(screen.queryByText(/send \d+ answers/)).toBeNull();
  });

  it('prefers a custom answer over selected suggestions', async () => {
    render(<OpenQuestionCluster questions={[dbQuestion]} sessionId={'sess-1' as never} />);

    fireEvent.click(screen.getByText('Postgres'));
    fireEvent.click(screen.getByText('other'));
    fireEvent.change(screen.getByPlaceholderText('write your own answer…'), {
      target: { value: '  use Neon  ' },
    });

    const submit = await screen.findByText('send answer');
    fireEvent.click(submit);

    expect(state.answerOpenQuestions).toHaveBeenCalledWith(
      'sess-1',
      [{ id: 'oq-1', text: 'Use Postgres or SQLite?', answer: 'use Neon' }],
      'agent-1',
    );
  });

  it('drops a question whose draft was emptied (select then deselect)', () => {
    render(<OpenQuestionCluster questions={[dbQuestion]} sessionId={'sess-1' as never} />);

    fireEvent.click(screen.getByText('Postgres'));
    expect(screen.queryByText('send answer')).toBeTruthy();

    fireEvent.click(screen.getByText('Postgres'));
    expect(screen.queryByText('send answer')).toBeNull();
  });

  it('targets the agent that authored the first question in the cluster', async () => {
    const fromAgent2 = makeQuestion({
      id: 'oq-1',
      text: 'Use Postgres or SQLite?',
      suggestedAnswers: ['Postgres', 'SQLite'],
      createdByAgentId: 'agent-2',
    });

    render(
      <OpenQuestionCluster questions={[fromAgent2, cacheQuestion]} sessionId={'sess-1' as never} />,
    );

    fireEvent.click(screen.getByText('Postgres'));
    fireEvent.click(screen.getByText('Redis'));

    fireEvent.click(await screen.findByText('send 2 answers'));

    expect(state.answerOpenQuestions).toHaveBeenCalledWith('sess-1', expect.any(Array), 'agent-2');
  });

  it('flashes the submitted ids and clears their drafts on submit', async () => {
    render(
      <OpenQuestionCluster questions={[dbQuestion, cacheQuestion]} sessionId={'sess-1' as never} />,
    );

    fireEvent.click(screen.getByText('Postgres'));
    fireEvent.click(screen.getByText('Redis'));

    fireEvent.click(await screen.findByText('send 2 answers'));

    const ui = useOpenQuestions.getState();
    expect(ui.justAnswered).toEqual(['oq-1', 'oq-2']);
    expect(ui.drafts).toEqual({});
    expect(screen.queryByText('send 2 answers')).toBeNull();
  });
});
