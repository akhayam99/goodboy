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

type EnterParams = {
  readonly target: HTMLElement;
  readonly isFromOutside: boolean;
};

const enterAndRead = ({ target, isFromOutside }: EnterParams): string | null => {
  const open = new Set(screen.queryAllByRole('tooltip'));
  const outside = isFromOutside ? null : (target.parentElement ?? document.body);
  vi.useFakeTimers();
  if (outside === null) {
    fireEvent.mouseEnter(target);
  } else {
    fireEvent.mouseOut(outside, { relatedTarget: target });
  }
  act(() => {
    vi.advanceTimersByTime(HOVER_INTENT_MS);
  });
  vi.useRealTimers();
  const innermost = screen
    .queryAllByRole('tooltip')
    .filter((tip) => !open.has(tip))
    .pop();
  const text = innermost === undefined ? null : (innermost.textContent ?? '');
  if (outside === null) {
    fireEvent.mouseLeave(target);
  } else {
    fireEvent.mouseOut(target, { relatedTarget: outside });
  }
  return text;
};

export const queryTooltipTextOf = ({ element }: { element: HTMLElement }): string | null => {
  const hovered = isDisabled({ element }) ? anchorOf({ element }) : element;
  const own = enterAndRead({ target: hovered, isFromOutside: false });
  if (own !== null) {
    return own;
  }
  const wrapper = hovered.parentElement;
  const inWrapper =
    wrapper === null ? null : enterAndRead({ target: wrapper, isFromOutside: false });
  return inWrapper ?? enterAndRead({ target: hovered, isFromOutside: true });
};

export const tooltipTextOf = ({ element }: { element: HTMLElement }): string => {
  const text = queryTooltipTextOf({ element });
  if (text === null) {
    throw new Error('hovering the element opened no tooltip');
  }
  return text;
};

export const asCutText = ({ element }: { element: HTMLElement }): HTMLElement => {
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: 240 });
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: 120 });
  return element;
};
