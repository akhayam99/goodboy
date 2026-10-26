import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStorySpies, storySpies, stubStoryInvoke } from '../../../../store/storyHarness';
import { useWindowHeartbeat } from '.';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);

type Reply = {
  readonly hasResumed: boolean;
};

const beats = (): ReadonlyArray<unknown> =>
  storySpies.tauriInvoke.mock.calls
    .filter((call) => call[0] === 'window_heartbeat')
    .map((call) => call[1]);

const setVisibility = (state: 'visible' | 'hidden'): void => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
};

let reply: Reply = { hasResumed: false };

beforeEach(() => {
  vi.useFakeTimers();
  resetStorySpies();
  reply = { hasResumed: false };
  setVisibility('visible');
  stubStoryInvoke({ window_heartbeat: () => reply });
});

afterEach(() => {
  vi.useRealTimers();
  setVisibility('visible');
});

describe('useWindowHeartbeat', () => {
  it('beats at once and every five seconds, saying the window is visible', async () => {
    const onResumed = vi.fn();
    renderHook(() => useWindowHeartbeat({ onResumed }));

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(beats()).toEqual([{ isVisible: true }, { isVisible: true }, { isVisible: true }]);
    expect(onResumed).not.toHaveBeenCalled();
  });

  it('tells the backend the moment the window is hidden', async () => {
    renderHook(() => useWindowHeartbeat({ onResumed: vi.fn() }));
    await vi.advanceTimersByTimeAsync(0);

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);

    expect(beats().at(-1)).toEqual({ isVisible: false });
  });

  it('offers the saved report once when the backend says the window came back', async () => {
    const onResumed = vi.fn();
    renderHook(() => useWindowHeartbeat({ onResumed }));
    await vi.advanceTimersByTimeAsync(0);

    reply = { hasResumed: true };
    await vi.advanceTimersByTimeAsync(5_000);
    reply = { hasResumed: false };
    await vi.advanceTimersByTimeAsync(10_000);

    expect(onResumed).toHaveBeenCalledTimes(1);
  });

  it('stops beating when the window component goes away', async () => {
    const { unmount } = renderHook(() => useWindowHeartbeat({ onResumed: vi.fn() }));
    await vi.advanceTimersByTimeAsync(0);
    unmount();
    const before = beats().length;

    await vi.advanceTimersByTimeAsync(30_000);

    expect(beats()).toHaveLength(before);
  });

  it('keeps beating when one beat fails', async () => {
    stubStoryInvoke({
      window_heartbeat: () => {
        throw new Error('ipc closed');
      },
    });
    renderHook(() => useWindowHeartbeat({ onResumed: vi.fn() }));

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(beats().length).toBeGreaterThanOrEqual(3);
  });
});
