// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { tintClasses } from '@goodboy/ui';
import type { OpenQuestion } from '@goodboy/types';
import { CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { QuestionCard } from '.';

afterEach(cleanup);

const LONG_OPTION =
  'rilancia lo step precedente dopo aver rebasato il branch, perché il refactor non è ancora ' +
  'arrivato su main e la build partirebbe dal codice vecchio';

const baseQuestion = {
  id: 'q1',
  text: 'pick a database',
  suggestedAnswers: ['sqlite', 'postgres'],
  createdAt: new Date().toISOString(),
  ownedByStepOrdinal: null,
  workflowId: null,
} as unknown as OpenQuestion;

const baseProps = {
  question: baseQuestion,
  selectedSuggestions: [] as ReadonlyArray<string>,
  customAnswer: '',
  showCustomField: false,
  justAnswered: false,
  onToggleSuggestion: vi.fn(),
  onSetCustomAnswer: vi.fn(),
  onToggleCustomField: vi.fn(),
  onDismiss: vi.fn(),
  onClearJustAnswered: vi.fn(),
};

describe('QuestionCard', () => {
  it('reads as a quiet workflow surface', () => {
    const { container } = render(<QuestionCard {...baseProps} />);
    const root = container.firstElementChild!;
    expect(root.className).toContain('border-l-2');
    expect(root.className).toContain('border-warning/40');
    expect(root.className).not.toContain('rounded-lg');
  });

  it('keeps just-answered feedback on the shared question tone', () => {
    const { container } = render(<QuestionCard {...baseProps} justAnswered />);
    const root = container.firstElementChild as HTMLElement;
    const questionTint = tintClasses(CONCEPT_TONE.questions);
    const feedbackIcon = screen.getByTitle(/dismiss question/i).querySelector('svg');

    expect(root.className).toContain(questionTint.border);
    expect(root.className).not.toContain('success');
    expect(feedbackIcon?.getAttribute('class')).toContain(questionTint.icon);
  });

  it('renders the question text with one button per suggestion', () => {
    render(<QuestionCard {...baseProps} />);
    expect(screen.getByText('pick a database')).toBeDefined();
    expect(screen.getByRole('radio', { name: 'sqlite' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'postgres' })).toBeDefined();
  });

  it('fires onDismiss when the close button is clicked', () => {
    const onDismiss = vi.fn();
    render(<QuestionCard {...baseProps} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTitle(/dismiss question/i));
    expect(onDismiss).toHaveBeenCalledWith('q1');
  });

  it('marks a recommended answer that matches a suggestion and toggles it on click', () => {
    const onToggleSuggestion = vi.fn();
    const question = { ...baseQuestion, recommendedAnswer: 'sqlite' } as OpenQuestion;
    render(
      <QuestionCard {...baseProps} question={question} onToggleSuggestion={onToggleSuggestion} />,
    );
    fireEvent.click(screen.getByTitle('sqlite (suggested)'));
    expect(onToggleSuggestion).toHaveBeenCalledWith('q1', 'sqlite', 'one');
  });

  it('prepends a free-form recommendation as a marked chip when it is not a suggestion', () => {
    const onToggleSuggestion = vi.fn();
    const question = { ...baseQuestion, recommendedAnswer: 'use both' } as OpenQuestion;
    render(
      <QuestionCard {...baseProps} question={question} onToggleSuggestion={onToggleSuggestion} />,
    );
    fireEvent.click(screen.getByTitle('use both (suggested)'));
    expect(onToggleSuggestion).toHaveBeenCalledWith('q1', 'use both', 'one');
  });

  it('exposes chips as radios in a radiogroup for a single-choice question', () => {
    render(<QuestionCard {...baseProps} />);
    expect(screen.getByRole('radiogroup', { name: /pick one answer/i })).toBeDefined();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('exposes chips as checkboxes for a multi-choice question', () => {
    const question = { ...baseQuestion, selectMode: 'many' } as OpenQuestion;
    const onToggleSuggestion = vi.fn();
    render(
      <QuestionCard {...baseProps} question={question} onToggleSuggestion={onToggleSuggestion} />,
    );
    const sqlite = screen.getByRole('checkbox', { name: 'sqlite' });
    const postgres = screen.getByRole('checkbox', { name: 'postgres' });
    fireEvent.click(sqlite);
    fireEvent.click(postgres);
    expect(onToggleSuggestion).toHaveBeenNthCalledWith(1, 'q1', 'sqlite', 'many');
    expect(onToggleSuggestion).toHaveBeenNthCalledWith(2, 'q1', 'postgres', 'many');
  });

  it('always exposes the "other" free-text trigger in both modes', () => {
    const single = render(<QuestionCard {...baseProps} />);
    expect(single.getByRole('button', { name: /other/i })).toBeDefined();
    single.unmount();
    const question = { ...baseQuestion, selectMode: 'many' } as OpenQuestion;
    render(<QuestionCard {...baseProps} question={question} />);
    expect(screen.getByRole('button', { name: /other/i })).toBeDefined();
  });

  it('gives every option a row of its own, in one column', () => {
    render(<QuestionCard {...baseProps} />);
    const group = screen.getByRole('radiogroup', { name: /pick one answer/i });
    const options = screen.getAllByRole('radio');

    expect(group.className).toContain('flex-col');
    expect(group.className).not.toContain('flex-wrap');
    expect(options).toHaveLength(2);
    expect(options.every((option) => option.className.includes('w-full'))).toBe(true);
  });

  it('reads a multi-choice question as one row per option too', () => {
    const question = { ...baseQuestion, selectMode: 'many' } as OpenQuestion;
    render(<QuestionCard {...baseProps} question={question} />);
    const group = screen.getByRole('group', { name: /pick one or more answers/i });

    expect(group.className).toContain('flex-col');
    expect(screen.getAllByRole('checkbox').every((box) => box.className.includes('w-full'))).toBe(
      true,
    );
  });

  it('shows a sentence-long option whole instead of cutting it off', () => {
    const question = {
      ...baseQuestion,
      suggestedAnswers: [LONG_OPTION, 'postgres'],
    } as unknown as OpenQuestion;
    render(<QuestionCard {...baseProps} question={question} />);

    expect(screen.getByRole('radio', { name: LONG_OPTION }).textContent).toBe(LONG_OPTION);
  });

  it('keeps the "other" trigger on its own row after the options', () => {
    render(<QuestionCard {...baseProps} />);
    const other = screen.getByRole('button', { name: /other/i });
    const lastOption = screen.getByRole('radio', { name: 'postgres' });

    expect(other.className).toContain('self-start');
    expect(lastOption.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('puts the suggested answer first however late it arrived', () => {
    const question = {
      ...baseQuestion,
      suggestedAnswers: ['postgres', 'sqlite', 'duckdb'],
      recommendedAnswer: 'sqlite',
    } as unknown as OpenQuestion;
    render(<QuestionCard {...baseProps} question={question} />);

    expect(screen.getAllByRole('radio').map((option) => option.textContent)).toEqual([
      'sqlite',
      'postgres',
      'duckdb',
    ]);
  });

  it('leaves the arrival order alone when no answer is marked suggested', () => {
    const question = {
      ...baseQuestion,
      suggestedAnswers: ['postgres', 'sqlite', 'duckdb'],
    } as unknown as OpenQuestion;
    render(<QuestionCard {...baseProps} question={question} />);

    expect(screen.getAllByRole('radio').map((option) => option.textContent)).toEqual([
      'postgres',
      'sqlite',
      'duckdb',
    ]);
  });
});
