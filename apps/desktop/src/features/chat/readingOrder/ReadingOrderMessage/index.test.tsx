// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('@goodboy/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/ui')>()),
  Markdown: ({ text }: { text: string }) => <div>{text}</div>,
}));

import { ReadingNotes } from '../ReadingNotes';
import { READING_BUDGETS } from '../readingBudgets';
import type { NotesRole } from '../readingOrderOf';
import { ReadingOrderMessage } from '.';

afterEach(cleanup);

const TARGET = { sessionId: null, workingDir: null };
const LONG = Array.from({ length: 6 }, (_, index) => `Finding ${index} in payments-api`).join('\n');

describe('ReadingOrderMessage', () => {
  it('clamps a long text at the budget and Show more opens it', () => {
    const { container } = render(
      <ReadingOrderMessage text={LONG} codeTarget={TARGET} clampLines={3} />,
    );
    expect(container.querySelector('[data-clamped="true"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(container.querySelector('[data-clamped="false"]')).not.toBeNull();
    screen.getByRole('button', { name: 'Show less' });
  });

  it('lets a finished answer of 12 lines read whole and clamps one of 13 behind Show more', () => {
    const lines = (count: number) =>
      Array.from({ length: count }, (_, index) => `Step ${index} in payments-api`).join('\n');
    const budget = READING_BUDGETS.answerClampLines;
    expect(budget).toBe(12);

    const whole = render(
      <ReadingOrderMessage text={lines(budget)} codeTarget={TARGET} clampLines={budget} />,
    );
    expect(whole.container.querySelector('[data-clamped="true"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    whole.unmount();

    const long = render(
      <ReadingOrderMessage text={lines(budget + 1)} codeTarget={TARGET} clampLines={budget} />,
    );
    expect(long.container.querySelector('[data-clamped="true"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(long.container.querySelector('[data-clamped="false"]')).not.toBeNull();
  });

  it('does not clamp while the text is live', () => {
    render(<ReadingOrderMessage text={LONG} codeTarget={TARGET} clampLines={null} />);
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('draws the outcome line before the text', () => {
    const { container } = render(
      <ReadingOrderMessage
        text="details"
        codeTarget={TARGET}
        clampLines={3}
        outcome={{ text: 'Changes needed: 1 blocker, 4 major.', tone: 'danger' }}
      />,
    );
    const outcome = screen.getByTestId('outcome-line');
    expect(outcome.textContent).toBe('Changes needed: 1 blocker, 4 major.');
    expect(container.firstElementChild).toBe(outcome);
  });

  it('shows 4 chips on one row and the rest behind +N', () => {
    const chips = ['Open diff', 'Copy findings', 'Run checks again', 'Open report', 'Put back'].map(
      (label) => <button key={label}>{label}</button>,
    );
    render(<ReadingOrderMessage text="x" codeTarget={TARGET} clampLines={3} chips={chips} />);
    expect(screen.queryByRole('button', { name: 'Put back' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '+1' }));
    screen.getByRole('button', { name: 'Put back' });
  });
});

describe('ReadingNotes', () => {
  const notesRole = ({ lineCount, isOpen }: { lineCount: number; isOpen: boolean }): NotesRole => ({
    kind: 'notes',
    notes: [{ key: 'n1', text: 'Reading the diff' }],
    lineCount,
    isOpen,
  });

  it('is closed by default and says how many lines are behind it', () => {
    render(<ReadingNotes role={notesRole({ lineCount: 14, isOpen: false })} />);
    const trigger = screen.getByRole('button', { name: 'Notes, 14 lines' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('starts open for a failed turn', () => {
    render(<ReadingNotes role={notesRole({ lineCount: 1, isOpen: true })} />);
    expect(
      screen.getByRole('button', { name: 'Notes, 1 line' }).getAttribute('aria-expanded'),
    ).toBe('true');
  });
});
