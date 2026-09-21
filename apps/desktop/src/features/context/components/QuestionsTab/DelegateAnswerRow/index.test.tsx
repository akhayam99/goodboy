// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QUESTION_DELEGATE_COPY } from '../../../questionDelegate';
import { DelegateAnswerRow } from '.';

afterEach(cleanup);

const row = () => screen.getByTestId('delegate-answer-row');

describe('DelegateAnswerRow', () => {
  it('offers the hand-over as another road, dashed like the free text row', () => {
    render(<DelegateAnswerRow state="available" onChoose={vi.fn()} />);
    expect(row().className).toContain('border-dashed');
    expect(screen.getByText(QUESTION_DELEGATE_COPY.offer)).toBeTruthy();
    expect(row().hasAttribute('disabled')).toBe(false);
  });

  it('calls back once when the user picks it', () => {
    const onChoose = vi.fn();
    render(<DelegateAnswerRow state="available" onChoose={onChoose} />);
    fireEvent.click(row());
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it('keeps the same label while the choice is staged', () => {
    render(<DelegateAnswerRow state="chosen" onChoose={vi.fn()} />);
    expect(screen.getByText(QUESTION_DELEGATE_COPY.offer)).toBeTruthy();
    expect(row().dataset['state']).toBe('chosen');
  });

  it('takes no second click once chosen, so the staged hints survive', () => {
    const onChoose = vi.fn();
    render(<DelegateAnswerRow state="chosen" onChoose={onChoose} />);
    fireEvent.click(row());
    expect(onChoose).not.toHaveBeenCalled();
    expect(row().hasAttribute('disabled')).toBe(true);
  });

  it('says an agent is already answering, and takes no second click', () => {
    render(<DelegateAnswerRow state="running" onChoose={vi.fn()} />);
    expect(screen.getByText(QUESTION_DELEGATE_COPY.running)).toBeTruthy();
    expect(row().hasAttribute('disabled')).toBe(true);
  });

  it('offers the hand-over again after a failed delegate', () => {
    const onChoose = vi.fn();
    render(<DelegateAnswerRow state="retry" onChoose={onChoose} />);
    expect(screen.getByText(QUESTION_DELEGATE_COPY.retry)).toBeTruthy();
    fireEvent.click(row());
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it('disables a second layer and says why', () => {
    render(<DelegateAnswerRow state="blocked" onChoose={vi.fn()} />);
    expect(row().hasAttribute('disabled')).toBe(true);
    expect(row().getAttribute('title')).toBe(QUESTION_DELEGATE_COPY.blocked);
    expect(QUESTION_DELEGATE_COPY.blocked).toBe(
      "a delegated agent can't delegate again. this one is yours to answer",
    );
  });
});
