// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useElapsedMs } from './index';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useElapsedMs', () => {
  it('stays silent while nothing runs', () => {
    const { result } = renderHook(() => useElapsedMs({ running: false }));
    expect(result.current).toBeNull();
  });

  it('ticks while running', () => {
    const { result } = renderHook(() => useElapsedMs({ running: true }));
    expect(result.current).toBe(0);
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(result.current).toBeGreaterThanOrEqual(3_000);
  });

  it('freezes the total once the run ends', () => {
    const { result, rerender } = renderHook(({ running }) => useElapsedMs({ running }), {
      initialProps: { running: true },
    });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    rerender({ running: false });
    const frozen = result.current;
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(frozen);
    expect(frozen).toBeGreaterThanOrEqual(5_000);
  });
});
