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

import { OpenQuestionInlineCard } from './OpenQuestionInlineCard';
import { useOpenQuestions } from '../../../context/components/QuestionsTab/useOpenQuestions';

const baseQuestion: OpenQuestion = {
  id: 'oq-1',
  sessionId: 'sess-1',
  text: 'Use Postgres or SQLite?',
  suggestedAnswers: ['Postgres', 'SQLite'],
  userAnswer: null,
  status: 'open',
  createdByAgentId: 'agent-1',
  turnOrdinal: 1,
  createdAt: '2026-06-13T00:00:00.000Z',
} as unknown as OpenQuestion;

beforeEach(() => {
  state.answerOpenQuestions.mockClear();
  state.dismissOpenQuestion.mockClear();
  useOpenQuestions.setState({ drafts: {}, justAnswered: [], pendingUndo: null });
});
afterEach(cleanup);

describe('OpenQuestionInlineCard', () => {
  it('renders the open question interactively and submits the chosen answer', async () => {
    render(<OpenQuestionInlineCard question={baseQuestion} sessionId={'sess-1' as never} />);

    expect(screen.getByText('Use Postgres or SQLite?')).toBeTruthy();
    fireEvent.click(screen.getByText('Postgres'));

    const submit = await screen.findByText('send answer');
    fireEvent.click(submit);

    expect(state.answerOpenQuestions).toHaveBeenCalledWith(
      'sess-1',
      [{ id: 'oq-1', text: 'Use Postgres or SQLite?', answer: 'Postgres' }],
      'agent-1',
    );
  });

  it('carries the data-oq-anchor on the open card', () => {
    const { container } = render(
      <OpenQuestionInlineCard question={baseQuestion} sessionId={'sess-1' as never} />,
    );
    expect(container.querySelector('[data-oq-anchor="oq-1"]')).toBeTruthy();
  });

  it('renders an answered question as a read-only record with the user answer', () => {
    const answered: OpenQuestion = {
      ...baseQuestion,
      status: 'answered',
      userAnswer: 'Postgres',
      answeredAt: '2026-06-13T00:05:00.000Z',
    } as unknown as OpenQuestion;

    const { container } = render(
      <OpenQuestionInlineCard question={answered} sessionId={'sess-1' as never} />,
    );

    expect(container.querySelector('[data-oq-anchor="oq-1"]')).toBeTruthy();
    expect(screen.queryByText('send answer')).toBeNull();

    fireEvent.click(screen.getByText('Use Postgres or SQLite?'));
    expect(screen.getByText('You answered:')).toBeTruthy();
    expect(screen.getByText('Postgres')).toBeTruthy();
  });

  it('renders the agent-resolved sentinel as a muted variant', () => {
    const resolved: OpenQuestion = {
      ...baseQuestion,
      status: 'answered',
      userAnswer: '[resolved by agent]',
      answeredAt: '2026-06-13T00:05:00.000Z',
    } as unknown as OpenQuestion;

    render(<OpenQuestionInlineCard question={resolved} sessionId={'sess-1' as never} />);

    fireEvent.click(screen.getByText('Use Postgres or SQLite?'));
    expect(screen.getByText('resolved by agent')).toBeTruthy();
    expect(screen.queryByText('You answered:')).toBeNull();
  });
});
