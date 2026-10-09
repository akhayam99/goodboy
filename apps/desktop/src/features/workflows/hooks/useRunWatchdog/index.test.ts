import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useAppStore } from '../../../../store';
import { RUN_WATCHDOG_TICK_MS } from '../../../../store/slices/workflows/sweepIdleRuns';
import { useRunWatchdog } from './index';

const sweepIdleRuns = vi.fn(async () => undefined);
const original = useAppStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  sweepIdleRuns.mockClear();
  useAppStore.setState({ sweepIdleRuns });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useAppStore.setState({ sweepIdleRuns: original.sweepIdleRuns });
});

describe('useRunWatchdog', () => {
  it('sweeps the runs on every tick', () => {
    renderHook(() => useRunWatchdog());

    vi.advanceTimersByTime(RUN_WATCHDOG_TICK_MS * 3);

    expect(sweepIdleRuns).toHaveBeenCalledTimes(3);
  });

  it('sweeps at once when the window comes back to the front', () => {
    renderHook(() => useRunWatchdog());

    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));

    expect(sweepIdleRuns).toHaveBeenCalledTimes(2);
  });

  it('stops sweeping once it unmounts', () => {
    const { unmount } = renderHook(() => useRunWatchdog());

    unmount();
    vi.advanceTimersByTime(RUN_WATCHDOG_TICK_MS * 2);
    window.dispatchEvent(new Event('focus'));

    expect(sweepIdleRuns).not.toHaveBeenCalled();
  });
});
