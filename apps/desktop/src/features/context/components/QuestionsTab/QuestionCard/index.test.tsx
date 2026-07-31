// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { OpenQuestion } from '@goodboy/types';
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
  it('reads as a filled demands-you surface', () => {
    const { container } = render(<QuestionCard {...baseProps} />);
    const root = container.firstElementChild!;
    expect(root.className).toContain('rounded-lg');
    expect(root.className).toContain('border-warning/40');
    expect(root.className).toContain('bg-warning/10');
  });

  it('renders the question text with one button per suggestion', () => {
    render(<QuestionCard {...baseProps} />);
    expect(screen.getByText('pick a database')).toBeDefined();
    expect(screen.getByRole('button', { name: 'sqlite' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'postgres' })).toBeDefined();
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
    expect(onToggleSuggestion).toHaveBeenCalledWith('q1', 'sqlite');
  });

  it('prepends a free-form recommendation as a marked chip when it is not a suggestion', () => {
    const onToggleSuggestion = vi.fn();
    const question = { ...baseQuestion, recommendedAnswer: 'use both' } as OpenQuestion;
    render(
      <QuestionCard {...baseProps} question={question} onToggleSuggestion={onToggleSuggestion} />,
    );
    fireEvent.click(screen.getByTitle('use both (suggested)'));
    expect(onToggleSuggestion).toHaveBeenCalledWith('q1', 'use both');
  });
});
