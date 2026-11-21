// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

const runningCount = vi.hoisted(() => ({ value: 0 }));
const mainWindow = vi.hoisted(() => ({ value: true }));
const hydrate = vi.hoisted(() => ({ spy: vi.fn(async () => undefined) }));

vi.mock('../../../../features/updater/hooks/useRunningAgentCount', () => ({
  useRunningAgentCount: () => runningCount.value,
}));
vi.mock('../../../../features/workspace/useIsMainWindow', () => ({
  useIsMainWindow: () => mainWindow.value,
}));
vi.mock('../../../../features/onboarding/onboardingSettings', () => ({
  hydrateOnboardingFromDb: hydrate.spy,
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { useRailFootEffects } from '.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  runningCount.value = 0;
  mainWindow.value = true;
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useRailFootEffects', () => {
  it('hands out one anchor ref for the update card', () => {
    const { result, rerender } = renderHook(() => useRailFootEffects({}));
    const first = result.current.anchorRef;

    rerender();

    expect(result.current.anchorRef).toBe(first);
    expect(first.current).toBeNull();
  });

  it('applies a queued update once no agent runs, and only once', () => {
    const applyUpdate = vi.fn(async () => undefined);
    runningCount.value = 2;
    useAppStore.setState({ applyUpdate, updateQueuedUntilIdle: true });
    const { rerender } = renderHook(() => useRailFootEffects({}));

    expect(applyUpdate).not.toHaveBeenCalled();

    runningCount.value = 0;
    rerender();
    rerender();

    expect(applyUpdate).toHaveBeenCalledOnce();
    expect(useAppStore.getState().updateQueuedUntilIdle).toBe(false);
  });

  it('leaves an update that was not queued alone', () => {
    const applyUpdate = vi.fn(async () => undefined);
    useAppStore.setState({ applyUpdate, updateQueuedUntilIdle: false });
    renderHook(() => useRailFootEffects({}));

    expect(applyUpdate).not.toHaveBeenCalled();
  });

  it('reloads the onboarding state when a secondary window takes focus', () => {
    mainWindow.value = false;
    renderHook(() => useRailFootEffects({}));

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(hydrate.spy).toHaveBeenCalledOnce();
  });

  it('does not reload the onboarding state from the main window', () => {
    renderHook(() => useRailFootEffects({}));

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(hydrate.spy).not.toHaveBeenCalled();
  });

  it('stops listening for focus once it unmounts', () => {
    mainWindow.value = false;
    const { unmount } = renderHook(() => useRailFootEffects({}));

    unmount();
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(hydrate.spy).not.toHaveBeenCalled();
  });
});
