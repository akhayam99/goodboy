// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { OpenQuestion, ProviderId } from '@goodboy/types';
import { QUESTION_DELEGATE_COPY, type DelegateRowState } from '../../../questionDelegate';
import type { QuestionDelegateControls } from '../../../hooks/useQuestionDelegateControls';
import { PERSON_ANSWERS, type QuestionDraft } from '../useOpenQuestions';
import { QuestionCard } from '.';

afterEach(cleanup);

const QUESTION = {
  id: 'q1',
  text: 'Which queue should webhook retries run on?\nThe rest of the plan follows from this. See `src/jobs/queue.ts`.',
  suggestedAnswers: ['Shared jobs queue', 'Dedicated retry queue', 'Retry in process'],
  recommendedAnswer: 'Dedicated retry queue',
  selectMode: 'one',
  createdAt: new Date().toISOString(),
  isBlocking: true,
  status: 'open',
  userAnswer: null,
} as unknown as OpenQuestion;

const delegateWith = (state: DelegateRowState): QuestionDelegateControls => ({
  delegateState: state,
  delegateHints: '',
  delegateRouting: { provider: 'anthropic', model: 'sonnet-5', effort: 'medium' },
  connectedProviders: ['anthropic'] as ReadonlyArray<ProviderId>,
  onChooseDelegate: vi.fn(),
  onCancelDelegate: vi.fn(),
  onDelegateHints: vi.fn(),
  onDelegateRouting: vi.fn(),
  onOpenDelegate: null,
  onTakeBackDelegate: vi.fn(),
});

const draftWith = (patch: Partial<QuestionDraft>): QuestionDraft => ({
  selectedSuggestions: [],
  customAnswer: '',
  showCustomField: false,
  answerIntent: PERSON_ANSWERS,
  ...patch,
});

type CardProps = ComponentProps<typeof QuestionCard>;

const renderCard = (patch: Partial<CardProps> = {}) => {
  const props: CardProps = {
    question: QUESTION,
    variant: 'full',
    state: 'open',
    askerName: 'Planner',
    askerKind: 'planner',
    age: '4m ago',
    draft: undefined,
    pager: null,
    delegate: delegateWith('available'),
    onToggleSuggestion: vi.fn(),
    onToggleCustomField: vi.fn(),
    onSetCustomAnswer: vi.fn(),
    onAnswer: vi.fn(),
    onSkip: vi.fn(),
    onUndo: null,
    onDismiss: vi.fn(),
    ...patch,
  };
  render(<QuestionCard {...props} />);
  return props;
};

describe('QuestionCard', () => {
  it('shows who asks, the blocking tag, the question as a title and its context', () => {
    renderCard();
    screen.getByText('Planner');
    screen.getByText('Blocking');
    screen.getByRole('heading', { name: 'Which queue should webhook retries run on?' });
    screen.getByText('src/jobs/queue.ts', { selector: 'span' });
  });

  it('lists the options as numbered tiles with the recommended one tagged', () => {
    renderCard();
    expect(screen.getAllByRole('radio').map((tile) => tile.getAttribute('aria-label'))).toEqual([
      'Dedicated retry queue',
      'Shared jobs queue',
      'Retry in process',
      'Something else',
    ]);
    screen.getByText('Recommended');
  });

  it('picks an option by click and by its number key', () => {
    const props = renderCard();
    fireEvent.click(screen.getByRole('radio', { name: 'Shared jobs queue' }));
    fireEvent.keyDown(screen.getByRole('article'), { key: '3' });
    expect(props.onToggleSuggestion).toHaveBeenNthCalledWith(1, 'Shared jobs queue');
    expect(props.onToggleSuggestion).toHaveBeenNthCalledWith(2, 'Retry in process');
  });

  it('opens the written answer with the key after the last option', () => {
    const props = renderCard();
    fireEvent.keyDown(screen.getByRole('article'), { key: '4' });
    expect(props.onToggleCustomField).toHaveBeenCalledOnce();
  });

  it('keeps Answer off until something is picked', () => {
    renderCard();
    expect(screen.getByRole('button', { name: 'Answer' }).hasAttribute('disabled')).toBe(true);
  });

  it('answers with Enter once an option is picked', () => {
    const props = renderCard({ draft: draftWith({ selectedSuggestions: ['Shared jobs queue'] }) });
    fireEvent.keyDown(screen.getByRole('article'), { key: 'Enter' });
    expect(props.onAnswer).toHaveBeenCalledOnce();
  });

  it('skips to the next question', () => {
    const props = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(props.onSkip).toHaveBeenCalledOnce();
  });

  it('offers a text field for a question with no options, and Enter answers', () => {
    const props = renderCard({
      question: {
        ...QUESTION,
        text: 'How long may a webhook keep retrying?',
        suggestedAnswers: [],
      },
      draft: draftWith({ customAnswer: 'Two days', showCustomField: true }),
    });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Your answer' }), { key: 'Enter' });
    expect(props.onAnswer).toHaveBeenCalledOnce();
  });

  it('shows a staged answer with Undo instead of the actions', () => {
    const onUndo = vi.fn();
    renderCard({
      state: 'staged',
      draft: draftWith({ selectedSuggestions: ['Shared jobs queue'] }),
      onUndo,
    });
    screen.getByText('Answered · sends with the rest');
    expect(screen.queryByRole('button', { name: 'Answer' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('turns Answer into Hand off once an agent decides', () => {
    renderCard({ delegate: delegateWith('chosen') });
    expect(screen.getByRole('button', { name: 'Hand off' }).hasAttribute('disabled')).toBe(false);
    screen.getByText(QUESTION_DELEGATE_COPY.chosen);
  });

  it('shows the waiting row while a delegated agent answers', () => {
    renderCard({ delegate: delegateWith('running') });
    screen.getByText(QUESTION_DELEGATE_COPY.running);
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('pages between the questions of the same agent', () => {
    const onNext = vi.fn();
    renderCard({
      pager: { index: 0, doneFlags: [false, false, true], onPrevious: vi.fn(), onNext },
    });
    screen.getByText('1 of 3');
    fireEvent.click(screen.getByRole('button', { name: 'Next question' }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('lets a question that does not block be dismissed', () => {
    const props = renderCard({ question: { ...QUESTION, isBlocking: false } });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss question' }));
    expect(props.onDismiss).toHaveBeenCalledOnce();
  });

  it('shows the answer that was sent', () => {
    renderCard({
      state: 'answered',
      question: { ...QUESTION, status: 'answered', userAnswer: 'Dedicated retry queue' },
    });
    screen.getByText('Dedicated retry queue');
    screen.getByText('Answered · sent to Planner');
  });
});
