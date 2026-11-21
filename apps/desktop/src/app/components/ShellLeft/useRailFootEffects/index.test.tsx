// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

vi.mock('../../../../features/onboarding/onboardingSettings', async () =>
  (await import('../../../../store/storyHarness')).onboardingStoreModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_NOW, nextAgentId, nextProviderRunId } from '@goodboy/types/testing';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { hydrateOnboardingFromDb } from '../../../../features/onboarding/onboardingSettings';
import { useRailFootEffects } from '.';

const setWindowLabel = ({ label }: { readonly label: string }) => {
  Reflect.set(window, '__TAURI_INTERNALS__', { metadata: { currentWindow: { label } } });
};

type RunningParams = { readonly isRunning: boolean };

const seedRunning = ({ isRunning }: RunningParams) => {
  useAppStore.setState({
    agentTurnState: isRunning
      ? { [nextAgentId()]: { kind: 'running', runId: nextProviderRunId(), startedAt: TEST_NOW } }
      : {},
  });
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  setWindowLabel({ label: 'main' });
  vi.mocked(hydrateOnboardingFromDb).mockClear();
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
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
    seedRunning({ isRunning: true });
    useAppStore.setState({ applyUpdate, updateQueuedUntilIdle: true });
    const { rerender } = renderHook(() => useRailFootEffects({}));

    expect(applyUpdate).not.toHaveBeenCalled();

    act(() => {
      seedRunning({ isRunning: false });
    });
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
    setWindowLabel({ label: 'workspace-acme' });
    renderHook(() => useRailFootEffects({}));

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(hydrateOnboardingFromDb).toHaveBeenCalledOnce();
  });

  it('does not reload the onboarding state from the main window', () => {
    renderHook(() => useRailFootEffects({}));

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(hydrateOnboardingFromDb).not.toHaveBeenCalled();
  });

  it('stops listening for focus once it unmounts', () => {
    setWindowLabel({ label: 'workspace-acme' });
    const { unmount } = renderHook(() => useRailFootEffects({}));

    unmount();
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(hydrateOnboardingFromDb).not.toHaveBeenCalled();
  });
});
