import { act, fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';

const HOVER_INTENT_MS = 400;

const anchorOf = ({ element }: { element: HTMLElement }): HTMLElement => {
  const anchor = element.parentElement;
  if (anchor === null) {
    throw new Error('a disabled control needs a tooltip anchor to take its hover');
  }
  return anchor;
};

const isDisabled = ({ element }: { element: HTMLElement }): boolean =>
  element instanceof HTMLButtonElement && element.disabled;

export const tooltipTextOf = ({ element }: { element: HTMLElement }): string => {
  const hovered = isDisabled({ element }) ? anchorOf({ element }) : element;
  vi.useFakeTimers();
  fireEvent.mouseEnter(hovered);
  act(() => {
    vi.advanceTimersByTime(HOVER_INTENT_MS);
  });
  vi.useRealTimers();
  const text = screen.getByRole('tooltip').textContent ?? '';
  fireEvent.mouseLeave(hovered);
  return text;
};
