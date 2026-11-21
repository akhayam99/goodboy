// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dayLabelOf } from '../../utils/time/dayLabelOf';
import { useDayClock } from './index';

describe('useDayClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('relabels a day that was Today once the clock passes midnight', () => {
    vi.setSystemTime(new Date(2026, 10, 20, 23, 59, 30));
    const commitAt = new Date(2026, 10, 20, 22, 0, 0).getTime();
    const { result } = renderHook(() => useDayClock());
    expect(dayLabelOf({ at: commitAt, now: result.current })).toBe('Today');

    act(() => {
      vi.advanceTimersByTime(31_000);
    });

    expect(dayLabelOf({ at: commitAt, now: result.current })).toBe('Yesterday');
  });

  it('keeps ticking each midnight and stops on unmount', () => {
    vi.setSystemTime(new Date(2026, 10, 20, 23, 59, 30));
    const commitAt = new Date(2026, 10, 20, 22, 0, 0).getTime();
    const { result, unmount } = renderHook(() => useDayClock());
    act(() => {
      vi.advanceTimersByTime(31_000 + 86_400_000);
    });
    expect(dayLabelOf({ at: commitAt, now: result.current })).toBe('Friday');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
