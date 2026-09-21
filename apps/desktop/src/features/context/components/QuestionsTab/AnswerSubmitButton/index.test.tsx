// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AnswerSubmitButton } from '.';

afterEach(cleanup);

describe('AnswerSubmitButton', () => {
  it('sends straight away and shows no stepper for a lone question', () => {
    render(<AnswerSubmitButton answerCount={1} totalCount={1} onClick={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Send' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.queryByLabelText(/question 1 of 1/i)).toBeNull();
  });

  it('shows pips, a disabled Back and Continue on the first of several', () => {
    render(
      <AnswerSubmitButton
        answerCount={0}
        totalCount={3}
        stepIndex={0}
        stepCount={3}
        action="continue"
        canGoBack={false}
        onBack={() => undefined}
        onClick={() => undefined}
      />,
    );

    expect(screen.getByLabelText('Question 1 of 3')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Back' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
  });

  it('fires onBack once Back is live', () => {
    const onBack = vi.fn();
    render(
      <AnswerSubmitButton
        answerCount={1}
        totalCount={3}
        stepIndex={1}
        stepCount={3}
        action="continue"
        canGoBack
        onBack={onBack}
        onClick={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('carries the recap line on the last question', () => {
    render(
      <AnswerSubmitButton
        answerCount={2}
        totalCount={2}
        stepIndex={1}
        stepCount={2}
        action="send"
        canGoBack
        onBack={() => undefined}
        onClick={() => undefined}
        recap="db → sqlite · cache → redis"
      />,
    );

    expect(screen.getByText('db → sqlite · cache → redis')).toBeDefined();
    expect(screen.getByText('2 of 2 answered')).toBeDefined();
  });

  it('refuses to send with nothing staged', () => {
    const onClick = vi.fn();
    render(
      <AnswerSubmitButton
        answerCount={0}
        totalCount={2}
        stepIndex={1}
        stepCount={2}
        action="send"
        disabled
        onClick={onClick}
      />,
    );

    const send = screen.getByRole('button', { name: 'Send' });
    expect(send.hasAttribute('disabled')).toBe(true);
    fireEvent.click(send);
    expect(onClick).not.toHaveBeenCalled();
  });
});
