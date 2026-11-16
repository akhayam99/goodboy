// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { MOCK_SCENES } from '../..';
import { AUTO_SESSION } from '../u24/autoSceneSeed';
import { U44_BRANCH_RUNS_LINKED_SCENES } from './branch-runs-linked';

const SETTLE_MS = 2_000;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    if (command === 'db_select') {
      return Promise.resolve([]);
    }
    return sceneInvoke({ command, args });
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (): Promise<void> => {
  const Scene = U44_BRANCH_RUNS_LINKED_SCENES['u44-branch-runs-linked'];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

describe('the u44 branch runs linked scene', () => {
  it('registers the scene in the mock registry', () => {
    expect(MOCK_SCENES['u44-branch-runs-linked']).toBeDefined();
  });

  it('seeds a one mount session whose agents recorded no mount', async () => {
    await mount();

    const state = useAppStore.getState();
    expect(state.sessionMounts[AUTO_SESSION.id]).toHaveLength(1);
    expect(state.sessionPhaseRuns[AUTO_SESSION.id]?.every((agent) => agent.mountId == null)).toBe(
      true,
    );
  });

  it('shows the Lead and its agents under the branch row', async () => {
    await mount();

    screen.getByText(/Lead is working on this branch\. 3 agents ran here\./);
    screen.getByText('Implementer');
    expect(screen.queryByText('Nothing ran on this branch yet')).toBeNull();
  });
});
