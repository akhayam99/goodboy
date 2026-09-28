// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useScrollPin } from './useScrollPin';

type Box = {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
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
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
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
});
