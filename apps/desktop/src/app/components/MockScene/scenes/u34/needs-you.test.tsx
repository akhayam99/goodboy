// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { MOCK_SCENES } from '../..';
import { U34_NEEDS_YOU_SCENES } from './needs-you';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U34_NEEDS_YOU_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  resetWorktreeStatusCache();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
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

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U34_NEEDS_YOU_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const board = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-slot="branch-board-section"]');

describe('the u34 needs you scenes', () => {
  it('registers every scene for the capture', () => {
    Object.entries(U34_NEEDS_YOU_SCENES).forEach(([name, Scene]) =>
      expect(MOCK_SCENES[name]).toBe(Scene),
    );
  });

  it('u34-needs-you-question holds the question on the board', async () => {
    await mount('u34-needs-you-question');

    expect(board()?.querySelectorAll('button').length).toBeGreaterThan(0);
  });

  it('u34-needs-you-run-question holds the waiting run and the question on one board', async () => {
    await mount('u34-needs-you-run-question');

    expect(document.querySelectorAll('[data-slot="branch-board"]')).toHaveLength(1);
    expect(board()?.querySelectorAll('button').length).toBeGreaterThan(1);
  });
});
