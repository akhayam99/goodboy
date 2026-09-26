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

  it('anchors a running duration on the real startedAt, surviving a reload', () => {
    vi.setSystemTime(new Date('2026-06-08T10:00:14.000Z'));
    const { result } = renderHook(() =>
      useElapsedMs({ running: true, startedAt: '2026-06-08T10:00:00.000Z' }),
    );
    expect(result.current).toBe(14_000);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe(15_000);
  });

  it('computes a done duration from startedAt to endedAt, ignoring the clock', () => {
    vi.setSystemTime(new Date('2026-06-08T12:00:00.000Z'));
    const { result } = renderHook(() =>
      useElapsedMs({
        running: false,
        startedAt: '2026-06-08T10:00:00.000Z',
        endedAt: '2026-06-08T10:00:03.200Z',
      }),
    );
    expect(result.current).toBe(3_200);
  });

  it('reports a rough duration for a stopped tool with a startedAt but no endedAt', () => {
    vi.setSystemTime(new Date('2026-06-08T10:00:18.000Z'));
    const { result } = renderHook(() =>
      useElapsedMs({ running: false, startedAt: '2026-06-08T10:00:00.000Z' }),
    );
    expect(result.current).toBe(18_000);
  });
});
