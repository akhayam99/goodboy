// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { OpenQuestion } from '@goodboy/types';
import { QuestionCard } from './QuestionCard';

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
  collapsed: false,
  onToggleSuggestion: vi.fn(),
  onSetCustomAnswer: vi.fn(),
  onToggleCustomField: vi.fn(),
  onDismiss: vi.fn(),
  onClearJustAnswered: vi.fn(),
};

describe('QuestionCard', () => {
  it('renders the question text with one button per suggestion', () => {
    render(<QuestionCard {...baseProps} />);
    expect(screen.getByText('pick a database')).toBeDefined();
    expect(screen.getByRole('button', { name: 'sqlite' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'postgres' })).toBeDefined();
  });

  it('renders the collapsed variant when collapsed', () => {
    render(<QuestionCard {...baseProps} collapsed />);
    expect(screen.getByText('pick a database')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'sqlite' })).toBeNull();
  });

  it('fires onDismiss when the close button is clicked', () => {
    const onDismiss = vi.fn();
    render(<QuestionCard {...baseProps} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTitle(/dismiss question/i));
    expect(onDismiss).toHaveBeenCalledWith('q1');
  });
});
