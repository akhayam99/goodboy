import { act, fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';

const REST_MS = 500;

export type ShownFactCard = {
  readonly title: string;
  readonly rows: ReadonlyArray<readonly [string, string]>;
  readonly text: string;
};

export const factCardOf = ({ element }: { element: HTMLElement }): ShownFactCard => {
  vi.useFakeTimers();
  fireEvent.pointerEnter(element, { pointerType: 'mouse' });
  act(() => {
    vi.advanceTimersByTime(REST_MS);
  });
  vi.useRealTimers();
  const card = screen.queryByTestId('fact-card');
  if (card === null) {
    fireEvent.pointerLeave(element, { pointerType: 'mouse' });
    throw new Error('resting on the element opened no fact card');
  }
  const terms = Array.from(card.querySelectorAll<HTMLElement>('dt'));
  const shown = {
    title: card.querySelector('.text-heading')?.textContent ?? '',
    rows: terms.map(
      (term) => [term.textContent ?? '', term.nextElementSibling?.textContent ?? ''] as const,
    ),
    text: card.textContent ?? '',
  };
  fireEvent.pointerLeave(element, { pointerType: 'mouse' });
  return shown;
};
