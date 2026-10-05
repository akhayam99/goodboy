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

  it('sends the text as a message when that is offered and the text is ready', () => {
    const onSendAsMessage = vi.fn();
    render(
      <AnswerSubmitButton
        inputMode="text"
        optionCount={0}
        canAnswer
        isHandOff={false}
        onAnswer={vi.fn()}
        onSkip={null}
        onSendAsMessage={onSendAsMessage}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send as message' }));
    expect(onSendAsMessage).toHaveBeenCalledOnce();
  });

  it('keeps Send as message off until there is text', () => {
    render(
      <AnswerSubmitButton
        inputMode="text"
        optionCount={0}
        canAnswer={false}
        isHandOff={false}
        onAnswer={vi.fn()}
        onSkip={null}
        onSendAsMessage={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Send as message' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('offers no Send as message to a question that is not offered it or is handed off', () => {
    const { rerender } = render(
      <AnswerSubmitButton
        inputMode="text"
        optionCount={0}
        canAnswer
        isHandOff={false}
        onAnswer={vi.fn()}
        onSkip={null}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Send as message' })).toBeNull();
    rerender(
      <AnswerSubmitButton
        inputMode="text"
        optionCount={0}
        canAnswer
        isHandOff
        onAnswer={vi.fn()}
        onSkip={null}
        onSendAsMessage={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Send as message' })).toBeNull();
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
