// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useAppStore } from '../../../../store';
import { useMonitoringSignalRefresh } from './index';

const NOW = 1_000_000;
type RefreshParams = {
  readonly ports: ReadonlyArray<number>;
};

const refreshPorts = vi.fn(async (_params: RefreshParams) => undefined);
const load = vi.fn(async () => undefined);

let visibility: DocumentVisibilityState = 'visible';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  useAppStore.setState({
    refreshMonitorPorts: refreshPorts,
    loadWatchedPorts: load,
    monitorSnapshot: null,
    monitorPinned: [{ port: 9000, description: 'Mock API' }],
    monitorHidden: [],
    monitorLearned: { Harborline: [4300] },
    monitorScanned: {},
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  refreshPorts.mockClear();
  load.mockClear();
});

type AdvanceParams = {
  readonly ms: number;
};

const advance = async ({ ms }: AdvanceParams): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('useMonitoringSignalRefresh', () => {
  it('refreshes only the pinned and learned ports once the page is closed', async () => {
    renderHook(() => useMonitoringSignalRefresh({ isReady: true }));
    await advance({ ms: 0 });

    expect(load).toHaveBeenCalledTimes(1);
    expect(refreshPorts).toHaveBeenCalledWith({ ports: [4300, 9000] });
  });

  it('refreshes again every thirty seconds and updates the count', async () => {
    renderHook(() => useMonitoringSignalRefresh({ isReady: true }));
    await advance({ ms: 0 });
    refreshPorts.mockClear();

    await advance({ ms: 30_000 });
    await advance({ ms: 30_000 });

    expect(refreshPorts).toHaveBeenCalledTimes(2);
  });

  it('adds nothing while the open page keeps the snapshot fresh', async () => {
    renderHook(() => useMonitoringSignalRefresh({ isReady: true }));
    await advance({ ms: 0 });
    refreshPorts.mockClear();

    for (let step = 0; step < 6; step += 1) {
      act(() => {
        useAppStore.setState({
          monitorSnapshot: {
            listeners: [],
            processes: [],
            takenAt: Date.now(),
            isPlatformSupported: true,
          },
        });
      });
      await advance({ ms: 5000 });
    }

    expect(refreshPorts).not.toHaveBeenCalled();
  });

  it('stays still while the window is hidden and resumes when shown', async () => {
    renderHook(() => useMonitoringSignalRefresh({ isReady: true }));
    await advance({ ms: 0 });
    refreshPorts.mockClear();

    visibility = 'hidden';
    await advance({ ms: 90_000 });
    expect(refreshPorts).not.toHaveBeenCalled();

    visibility = 'visible';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(refreshPorts).toHaveBeenCalledTimes(1);
  });

  it('does nothing before the app is ready or when the user owns no port', async () => {
    const view = renderHook(() => useMonitoringSignalRefresh({ isReady: false }));
    await advance({ ms: 60_000 });
    expect(load).not.toHaveBeenCalled();
    view.unmount();

    useAppStore.setState({ monitorPinned: [], monitorLearned: {} });
    renderHook(() => useMonitoringSignalRefresh({ isReady: true }));
    await advance({ ms: 60_000 });

    expect(refreshPorts).not.toHaveBeenCalled();
  });

  it('stops once the caller unmounts', async () => {
    const view = renderHook(() => useMonitoringSignalRefresh({ isReady: true }));
    await advance({ ms: 0 });
    view.unmount();
    refreshPorts.mockClear();

    await advance({ ms: 120_000 });

    expect(refreshPorts).not.toHaveBeenCalled();
  });
});
