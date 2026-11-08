// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { HeightMotion } from '../components/HeightMotion';
import { DURATION_BASE_MS } from '../motionTimings';

const ROW_PX = 120;

let observers: Array<() => void> = [];

const resizeAll = () => {
  act(() => {
    for (const callback of observers) {
      callback();
    }
  });
};

const advance = ({ ms }: { readonly ms: number }) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

type SlotParams = { readonly isOpen: boolean };

const slot = ({ isOpen }: SlotParams) => (
  <HeightMotion isOpen={isOpen} parentGapRem={2}>
    {isOpen ? <p>Approve the plan</p> : null}
  </HeightMotion>
);

const wrapper = () => {
  const found = document.querySelector<HTMLElement>('[data-height-motion]');
  if (found === null) {
    throw new Error('The height motion wrapper is missing.');
  }
  return found;
};

beforeEach(() => {
  vi.useFakeTimers();
  observers = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        observers.push(callback);
      }
      observe = (): void => undefined;
      disconnect = (): void => undefined;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return new DOMRect(0, 0, 0, this.textContent === '' ? 0 : ROW_PX);
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('HeightMotion', () => {
  it('opens from zero height and cancels the parent gap when the first item arrives on an empty mount', () => {
    const view = render(slot({ isOpen: false }));
    resizeAll();

    expect(wrapper().dataset.heightMotion).toBe('closed');
    expect(wrapper().getAttribute('aria-hidden')).toBe('true');
    expect(wrapper().hidden).toBe(false);
    expect(wrapper().style.height).toBe('0px');
    expect(wrapper().style.marginTop).toBe('-2rem');

    view.rerender(slot({ isOpen: true }));

    expect(wrapper().dataset.heightMotion).toBe('moving');
    expect(wrapper().style.height).toBe('0px');
    expect(wrapper().style.marginTop).toBe('');

    resizeAll();

    expect(wrapper().dataset.heightMotion).toBe('moving');
    expect(wrapper().style.height).toBe(`${ROW_PX}px`);

    advance({ ms: DURATION_BASE_MS });

    expect(wrapper().dataset.heightMotion).toBe('rest');
    expect(wrapper().hasAttribute('aria-hidden')).toBe(false);
  });

  it('moves the height and the gap together to zero on close, then rests closed', () => {
    const view = render(slot({ isOpen: true }));
    resizeAll();

    expect(wrapper().dataset.heightMotion).toBe('rest');
    expect(wrapper().style.height).toBe(`${ROW_PX}px`);

    view.rerender(slot({ isOpen: false }));

    expect(wrapper().dataset.heightMotion).toBe('moving');
    expect(wrapper().style.marginTop).toBe('-2rem');
    expect(wrapper().hasAttribute('aria-hidden')).toBe(false);

    resizeAll();

    expect(wrapper().dataset.heightMotion).toBe('moving');
    expect(wrapper().style.height).toBe('0px');

    advance({ ms: DURATION_BASE_MS });

    expect(wrapper().dataset.heightMotion).toBe('closed');
    expect(wrapper().getAttribute('aria-hidden')).toBe('true');
    expect(wrapper().style.marginTop).toBe('-2rem');
  });

  it('rests at its measured height on an open mount, with no motion and no offset', () => {
    render(slot({ isOpen: true }));
    resizeAll();

    expect(wrapper().dataset.heightMotion).toBe('rest');
    expect(wrapper().style.height).toBe(`${ROW_PX}px`);
    expect(wrapper().style.marginTop).toBe('');
  });
});
