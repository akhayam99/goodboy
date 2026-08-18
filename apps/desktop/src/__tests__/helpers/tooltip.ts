import { act, fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';

const HOVER_INTENT_MS = 400;

export const tooltipTextOf = ({ element }: { element: HTMLElement }): string => {
  vi.useFakeTimers();
  fireEvent.mouseEnter(element);
  act(() => {
    vi.advanceTimersByTime(HOVER_INTENT_MS);
  });
  vi.useRealTimers();
  return screen.getByRole('tooltip').textContent ?? '';
};
