// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { tintClasses } from '@goodboy/ui';
import type { OpenQuestion } from '@goodboy/types';
import { CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { QuestionCard } from '.';

afterEach(cleanup);

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
});
