// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSettleElapsed } from './index';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useSettleElapsed', () => {
  it('stays false until ms elapses, then flips true', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSettleElapsed({ ms: 10_000 }));

    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current).toBe(true);
  });

  it('does not reset when resetKey is omitted across rerenders', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(() => useSettleElapsed({ ms: 10_000 }));

    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    rerender();
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(result.current).toBe(true);
  });

  it('resets and restarts the timer when resetKey changes', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ resetKey }: { resetKey: string }) => useSettleElapsed({ ms: 10_000, resetKey }),
      { initialProps: { resetKey: 'a' } },
    );

    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    rerender({ resetKey: 'b' });

    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe(true);
  });

  it('re-arms after it has already elapsed once the resetKey changes', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ resetKey }: { resetKey: string }) => useSettleElapsed({ ms: 10_000, resetKey }),
      { initialProps: { resetKey: 'session-1' } },
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(true);

    rerender({ resetKey: 'session-2' });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(9_999);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });
});
