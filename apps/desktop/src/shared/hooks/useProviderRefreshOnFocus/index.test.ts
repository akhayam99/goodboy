// @vitest-environment happy-dom

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProviderRefreshOnFocus } from './index';

const state = vi.hoisted(() => ({
  refreshProviders: vi.fn(async () => undefined),
  bootPhase: 'pending',
  providerLifecycle: {},
  providerConnect: {},
  providerHealth: {} as Record<string, unknown>,
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
  state.providerHealth = {};
});

afterEach(() => {
  cleanup();
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

  it('does not repeat a focus during boot when the ready kick runs', async () => {
    state.bootPhase = 'loading-workspaces';
    const view = renderHook(() => useProviderRefreshOnFocus());

    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.refreshProviders).toHaveBeenCalledOnce();

    state.bootPhase = 'ready';
    view.rerender();
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.refreshProviders).toHaveBeenCalledOnce();
  });

  it('waits five minutes to refresh on focus when every provider is healthy', async () => {
    state.bootPhase = 'ready';
    renderHook(() => useProviderRefreshOnFocus());
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.refreshProviders).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(2 * 60_000);
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.refreshProviders).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(4 * 60_000);
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.refreshProviders).toHaveBeenCalledTimes(2);
  });

  it('refreshes on focus after a minute when a provider is not healthy', async () => {
    state.bootPhase = 'ready';
    state.providerHealth = {
      cursor: { isBreakerOpen: true, standing: 'connected', evidence: { lastGoodAt: 1 } },
    };
    renderHook(() => useProviderRefreshOnFocus());
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.refreshProviders).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(30_000);
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.refreshProviders).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(40_000);
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.refreshProviders).toHaveBeenCalledTimes(2);
  });
});
