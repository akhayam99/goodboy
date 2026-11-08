// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useAppStore } from '../../../store';
import { useMonitorPolling } from './index';

const refresh = vi.fn(async () => undefined);
const load = vi.fn(async () => undefined);

let isFocused = true;
let visibility: DocumentVisibilityState = 'visible';

beforeEach(() => {
  vi.useFakeTimers();
  isFocused = true;
  visibility = 'visible';
  vi.spyOn(document, 'hasFocus').mockImplementation(() => isFocused);
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  useAppStore.setState({ refreshMonitorSnapshot: refresh, loadWatchedPorts: load });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  refresh.mockClear();
  load.mockClear();
});

const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('useMonitorPolling', () => {
  it('loads the watched ports once and takes a first snapshot on mount', async () => {
    renderHook(() => useMonitorPolling());
    await advance(0);

    expect(load).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('polls every five seconds while the window is visible and focused', async () => {
    renderHook(() => useMonitorPolling());
    await advance(0);
    await advance(5000);
    await advance(5000);

    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('does not poll while the window is hidden or unfocused', async () => {
    renderHook(() => useMonitorPolling());
    await advance(0);
    refresh.mockClear();

    visibility = 'hidden';
    await advance(10000);
    visibility = 'visible';
    isFocused = false;
    await advance(10000);

    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes when the window gets focus back', async () => {
    renderHook(() => useMonitorPolling());
    await advance(0);
    refresh.mockClear();

    isFocused = true;
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('stops polling and listening once the caller unmounts', async () => {
    const view = renderHook(() => useMonitorPolling());
    await advance(0);
    view.unmount();
    refresh.mockClear();

    await advance(20000);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it('starts one interval however many surfaces ask for the snapshot', async () => {
    renderHook(() => useMonitorPolling());
    renderHook(() => useMonitorPolling());
    await advance(0);
    refresh.mockClear();

    await advance(5000);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps polling for the surface that stays when the other one unmounts', async () => {
    const first = renderHook(() => useMonitorPolling());
    renderHook(() => useMonitorPolling());
    await advance(0);
    first.unmount();
    refresh.mockClear();

    await advance(5000);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not poll or load while the surface is not on screen', async () => {
    const view = renderHook(({ isEnabled }) => useMonitorPolling({ isEnabled }), {
      initialProps: { isEnabled: false },
    });
    await advance(20000);

    expect(load).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();

    view.rerender({ isEnabled: true });
    await advance(0);
    expect(refresh).toHaveBeenCalledTimes(1);

    view.rerender({ isEnabled: false });
    refresh.mockClear();
    await advance(20000);
    expect(refresh).not.toHaveBeenCalled();
  });
});
