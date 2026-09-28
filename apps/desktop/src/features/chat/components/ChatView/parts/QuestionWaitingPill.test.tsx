// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { OpenQuestionId } from '@goodboy/types';
import { QuestionWaitingPill } from './QuestionWaitingPill';

afterEach(cleanup);

const QUESTION_ID = 'oq-1' as OpenQuestionId;

describe('QuestionWaitingPill', () => {
  it('says how many questions wait', () => {
    render(<QuestionWaitingPill count={1} questionId={QUESTION_ID} />);
    screen.getByRole('button', { name: '1 question waiting' });
    cleanup();
    render(<QuestionWaitingPill count={3} questionId={QUESTION_ID} />);
    screen.getByRole('button', { name: '3 questions waiting' });
  });

  it('brings the question into view and focuses its card', () => {
    render(
      <>
        <div data-oq-anchor="oq-1">
          <article tabIndex={-1} data-question-card="oq-1" aria-label="the card" />
        </div>
        <QuestionWaitingPill count={1} questionId={QUESTION_ID} />
      </>,
    );
    const anchor = document.querySelector<HTMLElement>('[data-oq-anchor="oq-1"]')!;
    const scrollIntoView = vi.fn();
    anchor.scrollIntoView = scrollIntoView;
    fireEvent.click(screen.getByRole('button', { name: '1 question waiting' }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(document.activeElement).toBe(screen.getByRole('article', { name: 'the card' }));
  });
});
