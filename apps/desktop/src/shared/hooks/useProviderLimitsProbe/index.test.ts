// @vitest-environment happy-dom

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProviderLimitsProbe } from './index';

const state = vi.hoisted(() => ({
  probeProviderLimits: vi.fn(async () => undefined),
  bootPhase: 'pending',
}));

vi.mock('../../../store/store', () => {
  const useAppStore = Object.assign((selector: (value: typeof state) => unknown) =>
    selector(state),
  );
  return { useAppStore };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  state.bootPhase = 'pending';
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useProviderLimitsProbe', () => {
  it('does nothing before boot is ready', async () => {
    renderHook(() => useProviderLimitsProbe());
    await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
    expect(state.probeProviderLimits).not.toHaveBeenCalled();
  });

  it('probes again after 15 minutes once boot is ready', async () => {
    state.bootPhase = 'ready';
    renderHook(() => useProviderLimitsProbe());

    await vi.advanceTimersByTimeAsync(14 * 60 * 1000);
    expect(state.probeProviderLimits).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(state.probeProviderLimits).toHaveBeenCalledOnce();
  });

  it('does not re-probe on a focus event inside the 15 minute window', async () => {
    state.bootPhase = 'ready';
    renderHook(() => useProviderLimitsProbe());

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.probeProviderLimits).not.toHaveBeenCalled();
  });

  it('does not double-probe when a focus follows the scheduled probe closely', async () => {
    state.bootPhase = 'ready';
    renderHook(() => useProviderLimitsProbe());

    await vi.advanceTimersByTimeAsync(16 * 60 * 1000);
    expect(state.probeProviderLimits).toHaveBeenCalledOnce();

    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.probeProviderLimits).toHaveBeenCalledOnce();
  });
});
