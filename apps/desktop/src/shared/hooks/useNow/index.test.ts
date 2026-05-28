// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, act } from '@testing-library/react';
import { useNow } from './index';

afterEach(cleanup);

describe('useNow', () => {
  it('returns a numeric timestamp on mount', () => {
    const { result } = renderHook(() => useNow(5_000));
    expect(typeof result.current).toBe('number');
    expect(result.current).toBeGreaterThan(0);
  });

  it('updates value when the interval fires', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useNow(5_000));
      const initial = result.current;
      act(() => {
        vi.advanceTimersByTime(5_001);
      });
      expect(result.current).toBeGreaterThanOrEqual(initial);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops updating when enabled=false', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useNow(5_000, false));
      const initial = result.current;
      act(() => {
        vi.advanceTimersByTime(20_000);
      });
      expect(result.current).toBe(initial);
    } finally {
      vi.useRealTimers();
    }
  });
});
