// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { OUTLINE_ASIDE_MIN_WIDTH, useOutlinePlacement } from './index';

type Callback = (
  entries: ReadonlyArray<{ readonly contentRect: { readonly width: number } }>,
) => void;

const observers: Array<Callback> = [];

class FakeResizeObserver {
  constructor(callback: Callback) {
    observers.push(callback);
  }
  observe() {}
  disconnect() {}
}

const renderPlacement = ({ width }: { readonly width: number }) => {
  const containerRef = { current: { clientWidth: width } as HTMLElement };
  return { ...renderHook(() => useOutlinePlacement({ containerRef })), containerRef };
};

afterEach(() => {
  observers.length = 0;
  vi.unstubAllGlobals();
});

describe('useOutlinePlacement', () => {
  it('keeps the aside while the container is wide enough', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const { result } = renderPlacement({ width: OUTLINE_ASIDE_MIN_WIDTH });
    expect(result.current).toBe('aside');
  });

  it('moves the outline inline once the container is narrow', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const { result } = renderPlacement({ width: OUTLINE_ASIDE_MIN_WIDTH - 1 });
    expect(result.current).toBe('inline');
  });

  it('follows a later resize of the container', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const { result } = renderPlacement({ width: 900 });
    const resizeTo = (width: number) => {
      act(() => {
        observers.forEach((callback) => callback([{ contentRect: { width } }]));
      });
    };
    resizeTo(400);
    expect(result.current).toBe('inline');
    resizeTo(900);
    expect(result.current).toBe('aside');
  });

  it('keeps the aside when the container cannot be measured', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const { result } = renderPlacement({ width: 0 });
    expect(result.current).toBe('aside');
  });

  it('keeps the aside where ResizeObserver is missing', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { result } = renderPlacement({ width: 320 });
    expect(result.current).toBe('aside');
  });
});
