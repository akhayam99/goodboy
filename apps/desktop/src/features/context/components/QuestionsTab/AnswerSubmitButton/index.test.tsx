// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AnswerSubmitButton } from '.';

afterEach(cleanup);

describe('AnswerSubmitButton', () => {
  it('hints the number keys and Enter for a choice', () => {
    render(
      <AnswerSubmitButton
        inputMode="one"
        optionCount={3}
        canAnswer={false}
        isHandOff={false}
        onAnswer={vi.fn()}
        onSkip={null}
      />,
    );
    screen.getByText('1-3');
    screen.getByText('to pick');
  });

  it('says toggle for a multiple choice', () => {
    render(
      <AnswerSubmitButton
        inputMode="many"
        optionCount={4}
        canAnswer={false}
        isHandOff={false}
        onAnswer={vi.fn()}
        onSkip={null}
      />,
    );
    screen.getByText('to toggle');
  });

  it('answers and skips', () => {
    const onAnswer = vi.fn();
    const onSkip = vi.fn();
    render(
      <AnswerSubmitButton
        inputMode="one"
        optionCount={2}
        canAnswer
        isHandOff={false}
        onAnswer={onAnswer}
        onSkip={onSkip}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onAnswer).toHaveBeenCalledOnce();
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('keeps Answer off until an answer is ready', () => {
    render(
      <AnswerSubmitButton
        inputMode="text"
        optionCount={0}
        canAnswer={false}
        isHandOff={false}
        onAnswer={vi.fn()}
        onSkip={null}
      />,
    );
    expect(screen.getByRole('button', { name: 'Answer' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });

  it('reads Hand off when an agent decides', () => {
    render(
      <AnswerSubmitButton
        inputMode="one"
        optionCount={2}
        canAnswer
        isHandOff
        onAnswer={vi.fn()}
        onSkip={null}
      />,
    );
    screen.getByRole('button', { name: 'Hand off' });
  });
});
