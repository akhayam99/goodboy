import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { FOCUS_RECHECK_DEBOUNCE_MS, useSessionFocusRecheck } from './index';

const SESSION_ID = 'session-1' as SessionId;

const recheckSessionMounts = vi.fn(async () => undefined);
const original = useAppStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  recheckSessionMounts.mockClear();
  useAppStore.setState({ currentSessionId: SESSION_ID, recheckSessionMounts });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useAppStore.setState({
    currentSessionId: original.currentSessionId,
    recheckSessionMounts: original.recheckSessionMounts,
  });
});

describe('useSessionFocusRecheck', () => {
  it('rechecks the current session once when focus and visibility fire together', () => {
    renderHook(() => useSessionFocusRecheck());

    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(FOCUS_RECHECK_DEBOUNCE_MS);

    expect(recheckSessionMounts).toHaveBeenCalledTimes(1);
    expect(recheckSessionMounts).toHaveBeenCalledWith({ sessionId: SESSION_ID, reason: 'focus' });
  });

  it('stays quiet with no session open', () => {
    useAppStore.setState({ currentSessionId: null });
    renderHook(() => useSessionFocusRecheck());

    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(FOCUS_RECHECK_DEBOUNCE_MS);

    expect(recheckSessionMounts).not.toHaveBeenCalled();
  });

  it('drops a pending recheck on unmount', () => {
    const { unmount } = renderHook(() => useSessionFocusRecheck());

    window.dispatchEvent(new Event('focus'));
    unmount();
    vi.advanceTimersByTime(FOCUS_RECHECK_DEBOUNCE_MS);

    expect(recheckSessionMounts).not.toHaveBeenCalled();
  });
});
