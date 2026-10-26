// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useScrollPin } from './useScrollPin';

type Box = {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
  isInside?: boolean;
  answerY?: number;
};

const scroller = (box: Box): HTMLDivElement =>
  ({
    get scrollHeight() {
      return box.scrollHeight;
    },
    get scrollTop() {
      return box.scrollTop;
    },
    set scrollTop(value: number) {
      box.scrollTop = Math.min(value, box.scrollHeight - box.clientHeight);
    },
    get clientHeight() {
      return box.clientHeight;
    },
    contains: () => box.isInside === true,
    getBoundingClientRect: () => ({ top: 0, bottom: box.clientHeight }),
    querySelectorAll: () =>
      box.answerY === undefined
        ? []
        : [
            {
              dataset: { revealAnswer: 'a' },
              getBoundingClientRect: () => {
                const top = (box.answerY ?? 0) - box.scrollTop;
                return { top, bottom: top + 100 };
              },
            },
          ],
    querySelector: () => null,
  }) as unknown as HTMLDivElement;

const open = (box: Box) => {
  const hook = renderHook(({ items }: { items: number }) => useScrollPin({ deps: [items] }), {
    initialProps: { items: 0 },
  });
  hook.result.current.scrollerRef.current = scroller(box);
  hook.rerender({ items: 1 });
  return hook;
};

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'],
  });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useScrollPin', () => {
  it('lands on the latest line when rows grow after the first layout', () => {
    const box = { scrollHeight: 1000, scrollTop: 0, clientHeight: 500 };
    const { result } = open(box);
    expect(box.scrollTop).toBe(500);

    box.scrollHeight = 1800;
    act(() => result.current.onScroll());
    box.scrollHeight = 2400;
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.pinned).toBe(true);
    expect(box.scrollTop).toBe(1900);
  });

  it('lets the user scroll away while the rows settle', () => {
    const box = { scrollHeight: 1000, scrollTop: 0, clientHeight: 500 };
    const { result } = open(box);

    act(() => result.current.onUserScroll());
    box.scrollTop = 100;
    act(() => result.current.onScroll());
    box.scrollHeight = 1800;
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.pinned).toBe(false);
    expect(box.scrollTop).toBe(100);
  });

  it('never pulls an unpinned reader down when new rows arrive', () => {
    const box = { scrollHeight: 1000, scrollTop: 0, clientHeight: 500 };
    const { result, rerender } = open(box);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => result.current.onUserScroll());
    box.scrollTop = 120;
    act(() => result.current.onScroll());
    expect(result.current.pinned).toBe(false);

    box.scrollHeight = 2200;
    rerender({ items: 2 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(box.scrollTop).toBe(120);
    expect(result.current.pinned).toBe(false);
  });

  it('pins again once the reader returns to the bottom', () => {
    const box = { scrollHeight: 1000, scrollTop: 0, clientHeight: 500 };
    const { result, rerender } = open(box);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => result.current.onUserScroll());
    box.scrollTop = 120;
    act(() => result.current.onScroll());
    box.scrollTop = 490;
    act(() => result.current.onScroll());
    expect(result.current.pinned).toBe(true);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    box.scrollHeight = 1600;
    rerender({ items: 3 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(box.scrollTop).toBe(1100);
  });

  it('lets go on the first upward nudge, however small', () => {
    const box = { scrollHeight: 1000, scrollTop: 0, clientHeight: 500 };
    const { result, rerender } = open(box);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(box.scrollTop).toBe(500);

    act(() => result.current.onUserScroll());
    box.scrollTop = 499;
    act(() => result.current.onScroll());
    expect(result.current.pinned).toBe(false);

    box.scrollHeight = 1400;
    rerender({ items: 2 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(box.scrollTop).toBe(499);
  });

  it('never moves an unpinned view toward the bottom while rows keep streaming', () => {
    const box = { scrollHeight: 3000, scrollTop: 0, clientHeight: 500 };
    const { result, rerender } = open(box);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const tops: number[] = [];
    for (let step = 0; step < 6; step += 1) {
      act(() => result.current.onUserScroll());
      box.scrollTop -= 1;
      act(() => result.current.onScroll());
      box.scrollHeight += 120;
      rerender({ items: 2 + step });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      tops.push(box.scrollTop);
    }
    expect(tops).toEqual([2499, 2498, 2497, 2496, 2495, 2494]);
  });

  it('keeps a thumb drag the reader own for its whole length', () => {
    const box = { scrollHeight: 3000, scrollTop: 0, clientHeight: 500 };
    const { result, rerender } = open(box);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(box.scrollTop).toBe(2500);

    const thumb = document.createElement('div');
    act(() => result.current.onPointerDown({ target: thumb }));
    const tops: number[] = [];
    for (let step = 0; step < 8; step += 1) {
      box.scrollTop -= 1;
      act(() => result.current.onScroll());
      box.scrollHeight += 120;
      rerender({ items: 2 + step });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      tops.push(box.scrollTop);
    }
    expect(tops).toEqual([2499, 2498, 2497, 2496, 2495, 2494, 2493, 2492]);
    expect(result.current.pinned).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('pointerup'));
    });
    expect(box.scrollTop).toBe(2492);
    expect(result.current.pinned).toBe(false);
  });

  it('keeps a keyboard scroll the reader own while its animation still moves', () => {
    const box = { scrollHeight: 3000, scrollTop: 0, clientHeight: 500 };
    const { result, rerender } = open(box);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => result.current.onUserScroll());
    for (let step = 0; step < 5; step += 1) {
      act(() => {
        vi.advanceTimersByTime(100);
      });
      box.scrollTop -= 40;
      act(() => result.current.onScroll());
      box.scrollHeight += 100;
      rerender({ items: 2 + step });
    }
    expect(box.scrollTop).toBe(2300);
    expect(result.current.pinned).toBe(false);
  });

  it('ignores a pointer down on a row, which is a click and no scroll gesture', () => {
    const box: Box = { scrollHeight: 1000, scrollTop: 0, clientHeight: 500 };
    const { result, rerender } = open(box);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const row = document.createElement('div');
    box.isInside = true;
    act(() => result.current.onPointerDown({ target: row }));
    box.scrollHeight = 1600;
    rerender({ items: 2 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(box.scrollTop).toBe(1100);
  });

  it('stays pinned when collapsing content clamps the top at the bottom', () => {
    const box = { scrollHeight: 1000, scrollTop: 0, clientHeight: 500 };
    const { result, rerender } = open(box);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(box.scrollTop).toBe(500);

    act(() => result.current.onUserScroll());
    box.scrollHeight = 900;
    box.scrollTop = 400;
    act(() => result.current.onScroll());
    expect(result.current.pinned).toBe(true);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    box.scrollHeight = 1300;
    rerender({ items: 2 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(box.scrollTop).toBe(800);
  });

  it('keeps a thumb drag when a wheel hold timer was armed just before the grab', () => {
    const box = { scrollHeight: 3000, scrollTop: 0, clientHeight: 500 };
    const { result, rerender } = open(box);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => result.current.onUserScroll());
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => result.current.onPointerDown({ target: document.createElement('div') }));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    box.scrollTop -= 1;
    act(() => result.current.onScroll());
    expect(result.current.pinned).toBe(false);
    box.scrollHeight += 120;
    rerender({ items: 2 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(box.scrollTop).toBe(2499);

    act(() => {
      window.dispatchEvent(new Event('pointerup'));
    });
    expect(box.scrollTop).toBe(2499);
  });

  it('keeps a drag released before its scroll event fires', () => {
    const box: Box = { scrollHeight: 2000, scrollTop: 0, clientHeight: 500 };
    const { result } = open(box);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(box.scrollTop).toBe(1500);

    act(() => result.current.onPointerDown({ target: document.createElement('div') }));
    box.scrollTop = 1400;
    act(() => {
      window.dispatchEvent(new Event('pointerup'));
    });
    expect(box.scrollTop).toBe(1400);
    expect(result.current.pinned).toBe(false);

    act(() => result.current.onScroll());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(box.scrollTop).toBe(1400);
    expect(result.current.pinned).toBe(false);
  });

  it('leaves a 1 px downward drag from an answer anchor where the reader put it', () => {
    const box: Box = { scrollHeight: 2000, scrollTop: 0, clientHeight: 500, answerY: 600 };
    const { result } = open(box);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(box.scrollTop).toBe(544);

    act(() => result.current.onPointerDown({ target: document.createElement('div') }));
    box.scrollTop = 545;
    act(() => result.current.onScroll());
    act(() => {
      window.dispatchEvent(new Event('pointerup'));
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(box.scrollTop).toBe(545);
  });
});
