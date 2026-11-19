// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { REST_HOVER_LEAVE_MS, REST_HOVER_REST_MS, useRestHover } from '../useRestHover';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const mountHover = () => renderHook(() => useRestHover<string>({}));

describe('useRestHover', () => {
  it('opens after the rest delay and closes after the leave delay', () => {
    const { result } = mountHover();

    act(() => {
      result.current.enter('ledger-core');
    });
    act(() => {
      vi.advanceTimersByTime(REST_HOVER_REST_MS);
    });
    expect(result.current.target).toBe('ledger-core');

    act(() => {
      result.current.leave();
    });
    act(() => {
      vi.advanceTimersByTime(REST_HOVER_LEAVE_MS);
    });
    expect(result.current.target).toBeNull();
  });

  it('drops a pending rest or leave timer when it unmounts', () => {
    const { result, unmount } = mountHover();

    act(() => {
      result.current.enter('ledger-core');
    });
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('schedules no close when a child calls leave after the hook unmounted', () => {
    const { result, unmount } = mountHover();
    act(() => {
      result.current.openNow('notify-relay');
    });
    const { leave } = result.current;

    unmount();
    leave();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('schedules no open when a child calls enter after the hook unmounted', () => {
    const { result, unmount } = mountHover();
    const { enter } = result.current;

    unmount();
    enter('payments-api');

    expect(vi.getTimerCount()).toBe(0);
  });
});
