// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProviderRefreshOnFocus } from './index';

const state = vi.hoisted(() => ({
  refreshProviders: vi.fn(async () => undefined),
  bootPhase: 'pending',
  providerLifecycle: {},
  providerConnect: {},
}));

vi.mock('../../../store/store', () => {
  const useAppStore = Object.assign(
    (selector: (value: typeof state) => unknown) => selector(state),
    { getState: () => state },
  );
  return { useAppStore };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  state.bootPhase = 'pending';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useProviderRefreshOnFocus', () => {
  it('runs one provider detection for a cold start followed by a window focus', async () => {
    state.bootPhase = 'pending';
    const view = renderHook(() => useProviderRefreshOnFocus());

    await vi.advanceTimersByTimeAsync(1000);
    expect(state.refreshProviders).not.toHaveBeenCalled();

    state.bootPhase = 'ready';
    view.rerender();
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.refreshProviders).toHaveBeenCalledOnce();

    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.refreshProviders).toHaveBeenCalledOnce();
  });
});
