// @vitest-environment happy-dom

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePoll } from './index';

type VisibilityParams = {
  readonly state: 'visible' | 'hidden';
};

const setVisibility = ({ state }: VisibilityParams): void => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
};

const setFocus = ({ isFocused }: { readonly isFocused: boolean }): void => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(isFocused);
};

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility({ state: 'visible' });
  setFocus({ isFocused: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  setVisibility({ state: 'visible' });
});

describe('usePoll', () => {
  it('runs once at mount and then every interval while the window is visible', () => {
    const run = vi.fn();
    renderHook(() => usePoll({ run, everyMs: 1000 }));
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3000);
    expect(run).toHaveBeenCalledTimes(4);
  });

  it('skips the first run when it is not immediate', () => {
    const run = vi.fn();
    renderHook(() => usePoll({ run, everyMs: 1000, isImmediate: false }));
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does no work while the window is hidden and catches up when it shows again', () => {
    const run = vi.fn();
    renderHook(() => usePoll({ run, everyMs: 1000 }));
    run.mockClear();
    setVisibility({ state: 'hidden' });
    vi.advanceTimersByTime(10_000);
    expect(run).not.toHaveBeenCalled();
    setVisibility({ state: 'visible' });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not run at mount in a hidden window', () => {
    setVisibility({ state: 'hidden' });
    const run = vi.fn();
    renderHook(() => usePoll({ run, everyMs: 1000 }));
    vi.advanceTimersByTime(5000);
    expect(run).not.toHaveBeenCalled();
  });

  it('a focused gate waits for focus as well as for a visible window', () => {
    setFocus({ isFocused: false });
    const run = vi.fn();
    renderHook(() => usePoll({ run, everyMs: 1000, gate: 'focused' }));
    vi.advanceTimersByTime(3000);
    expect(run).not.toHaveBeenCalled();
    setFocus({ isFocused: true });
    window.dispatchEvent(new Event('focus'));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled and starts when it is enabled', () => {
    const run = vi.fn();
    const { rerender } = renderHook(({ isEnabled }) => usePoll({ run, everyMs: 1000, isEnabled }), {
      initialProps: { isEnabled: false },
    });
    vi.advanceTimersByTime(3000);
    expect(run).not.toHaveBeenCalled();
    rerender({ isEnabled: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('calls the latest run without restarting the timer', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ run }) => usePoll({ run, everyMs: 1000, isImmediate: false }),
      { initialProps: { run: first } },
    );
    rerender({ run: second });
    vi.advanceTimersByTime(1000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('starts again, with a first run, when the restart key changes', () => {
    const run = vi.fn();
    const { rerender } = renderHook(
      ({ restartKey }) => usePoll({ run, everyMs: 1000, restartKey }),
      { initialProps: { restartKey: 'a' } },
    );
    run.mockClear();
    rerender({ restartKey: 'a' });
    expect(run).not.toHaveBeenCalled();
    rerender({ restartKey: 'b' });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('stops every timer and listener on unmount', () => {
    const run = vi.fn();
    const { unmount } = renderHook(() => usePoll({ run, everyMs: 1000 }));
    unmount();
    run.mockClear();
    vi.advanceTimersByTime(5000);
    setVisibility({ state: 'hidden' });
    setVisibility({ state: 'visible' });
    expect(run).not.toHaveBeenCalled();
  });
});
