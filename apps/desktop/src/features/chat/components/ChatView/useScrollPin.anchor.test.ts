// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useScrollPin } from './useScrollPin';

type Box = {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
};

type Geometry = {
  readonly box: Box;
  readonly answerTop: number;
  readonly answerHeight: number;
};

type OverflowParams = {
  readonly keys: ReadonlyArray<string>;
};

type OpenParams = Geometry & {
  readonly onRevealOverflow?: (params: OverflowParams) => void;
};

const ANSWER_KEY = 'run-1:text-3';
const observers: Array<() => void> = [];

class FakeResizeObserver {
  private readonly callback: () => void;
  constructor(callback: () => void) {
    this.callback = callback;
  }
  observe(): void {
    observers.push(this.callback);
  }
  disconnect(): void {
    const at = observers.indexOf(this.callback);
    if (at >= 0) {
      observers.splice(at, 1);
    }
  }
}

const growth = (): void => {
  for (const callback of [...observers]) {
    callback();
  }
};

const rect = ({ top, bottom }: { readonly top: number; readonly bottom: number }): DOMRect =>
  DOMRect.fromRect({ x: 0, y: top, width: 0, height: bottom - top });

const domScroller = ({ box, answerTop, answerHeight }: Geometry) => {
  const el = document.createElement('div');
  const content = document.createElement('div');
  content.dataset['scrollContent'] = '';
  el.appendChild(content);
  Object.defineProperty(el, 'scrollHeight', { get: () => box.scrollHeight });
  Object.defineProperty(el, 'clientHeight', { get: () => box.clientHeight });
  Object.defineProperty(el, 'scrollTop', {
    get: () => box.scrollTop,
    set: (value: number) => {
      box.scrollTop = Math.max(0, Math.min(value, box.scrollHeight - box.clientHeight));
    },
  });
  el.getBoundingClientRect = () => rect({ top: 0, bottom: box.clientHeight });
  const answer = document.createElement('div');
  answer.dataset['revealAnswer'] = ANSWER_KEY;
  answer.getBoundingClientRect = () =>
    rect({ top: answerTop - box.scrollTop, bottom: answerTop + answerHeight - box.scrollTop });
  content.appendChild(answer);
  return { el, answer };
};

const openDom = ({ onRevealOverflow, ...geometry }: OpenParams) => {
  const { el, answer } = domScroller(geometry);
  const hook = renderHook(
    ({ key }: { key: string }) =>
      useScrollPin({
        deps: [key],
        resetKey: key,
        ...(onRevealOverflow !== undefined && { onRevealOverflow }),
      }),
    { initialProps: { key: 'a' } },
  );
  hook.result.current.scrollerRef.current = el;
  hook.rerender({ key: 'b' });
  return { ...hook, el, answer };
};

beforeEach(() => {
  observers.length = 0;
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'],
  });
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useScrollPin answer anchor', () => {
  it('follows the bottom while the answer top is below the top of the view', () => {
    const box = { scrollHeight: 1000, scrollTop: 0, clientHeight: 500 };
    const { result } = openDom({ box, answerTop: 900, answerHeight: 100 });

    box.scrollHeight = 1100;
    act(() => growth());

    expect(box.scrollTop).toBe(600);
    expect(result.current.pinned).toBe(true);
  });

  it('stops at the answer top and shows the jump button instead of chasing the bottom', () => {
    const box = { scrollHeight: 1000, scrollTop: 500, clientHeight: 500 };
    const { result } = openDom({ box, answerTop: 600, answerHeight: 400 });

    box.scrollHeight = 1800;
    act(() => growth());
    act(() => result.current.onScroll());

    expect(box.scrollTop).toBe(544);
    expect(result.current.pinned).toBe(false);

    box.scrollHeight = 2400;
    act(() => growth());
    expect(box.scrollTop).toBe(544);
  });

  it('holds the answer top until the reveal ends, then leaves the reader there', () => {
    const box = { scrollHeight: 1800, scrollTop: 0, clientHeight: 500 };
    const { answer, result } = openDom({ box, answerTop: 600, answerHeight: 400 });
    act(() => growth());
    act(() => result.current.onScroll());
    expect(result.current.pinned).toBe(false);

    answer.remove();
    box.scrollHeight = 2600;
    act(() => growth());

    expect(box.scrollTop).toBe(544);
    expect(result.current.pinned).toBe(false);
  });

  it('shows the rest at once when the written text reaches the bottom of the view', () => {
    const onRevealOverflow = vi.fn();
    const box = { scrollHeight: 1800, scrollTop: 0, clientHeight: 500 };
    openDom({ box, answerTop: 600, answerHeight: 700, onRevealOverflow });

    act(() => growth());

    expect(onRevealOverflow).toHaveBeenCalledWith({ keys: [ANSWER_KEY] });
  });

  it('does not flush while the written text still fits in the view', () => {
    const onRevealOverflow = vi.fn();
    const box = { scrollHeight: 1800, scrollTop: 0, clientHeight: 500 };
    openDom({ box, answerTop: 600, answerHeight: 200, onRevealOverflow });

    act(() => growth());

    expect(onRevealOverflow).not.toHaveBeenCalled();
  });

  it('lets the reader take over: scrolling away stops the hold', () => {
    const box = { scrollHeight: 1800, scrollTop: 0, clientHeight: 500 };
    const { result } = openDom({ box, answerTop: 600, answerHeight: 400 });
    act(() => growth());
    expect(box.scrollTop).toBe(544);

    act(() => result.current.onUserScroll());
    box.scrollTop = 200;
    act(() => result.current.onScroll());
    box.scrollHeight = 2000;
    act(() => growth());

    expect(box.scrollTop).toBe(200);
    expect(result.current.pinned).toBe(false);
  });

  it('keeps the bottom after the jump button, whatever the answer top says', () => {
    const scrollTo = vi.fn();
    const box = { scrollHeight: 1800, scrollTop: 0, clientHeight: 500 };
    const { el, result } = openDom({ box, answerTop: 600, answerHeight: 400 });
    el.scrollTo = scrollTo;
    act(() => growth());
    act(() => result.current.onScroll());
    expect(result.current.pinned).toBe(false);

    act(() => result.current.jumpToLatest());
    expect(scrollTo).toHaveBeenCalledWith({ top: 1800, behavior: 'smooth' });
    box.scrollTop = 1300;
    act(() => result.current.onScroll());
    expect(result.current.pinned).toBe(true);

    box.scrollHeight = 2200;
    act(() => growth());
    expect(box.scrollTop).toBe(2200 - 500);
  });

  it('does not yank a reader who scrolled to the bottom during the reveal back up', () => {
    const box = { scrollHeight: 1800, scrollTop: 0, clientHeight: 500 };
    const { result } = openDom({ box, answerTop: 600, answerHeight: 400 });
    act(() => growth());
    act(() => result.current.onUserScroll());
    box.scrollTop = 1290;
    act(() => result.current.onScroll());
    expect(result.current.pinned).toBe(true);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    box.scrollHeight = 2000;
    act(() => growth());

    expect(box.scrollTop).toBe(1500);
  });
});
