// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow } from '../../hooks/useNow';
import { useElapsedMs } from '../../../features/chat/hooks/useElapsedMs';
import { useElapsedSincePhase } from '../../../app/components/BootSplash/useElapsedSincePhase';

type VisibilityParams = {
  readonly state: 'visible' | 'hidden';
};

const setVisibility = ({ state }: VisibilityParams): void => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility({ state: 'visible' });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setVisibility({ state: 'visible' });
});

describe('interval clocks go quiet in a hidden window', () => {
  it('useNow stops notifying while hidden and catches up when shown', () => {
    const { result } = renderHook(() => useNow(1_000));
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    const shownAt = result.current;

    setVisibility({ state: 'hidden' });
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current).toBe(shownAt);

    act(() => {
      setVisibility({ state: 'visible' });
    });
    expect(result.current).toBeGreaterThan(shownAt);
  });

  it('useElapsedMs does not re-render a running timer while hidden', () => {
    const renders = vi.fn();
    renderHook(() => {
      const elapsed = useElapsedMs({ running: true });
      renders(elapsed);
      return elapsed;
    });
    setVisibility({ state: 'hidden' });
    renders.mockClear();

    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    expect(renders).not.toHaveBeenCalled();
  });

  it('the boot splash clock does not tick while hidden', () => {
    const { result } = renderHook(() => useElapsedSincePhase({ phase: 'migrating' }));
    setVisibility({ state: 'hidden' });

    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    expect(result.current).toBe(0);
  });
});
