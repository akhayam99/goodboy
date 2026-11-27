// @vitest-environment happy-dom

vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 18, 10, 31));
});
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../../../store/runtime/worktreeStatuses/cache';
import { DELETED_BRANCH_SCENES } from './deleted-branch';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

afterAll(() => {
  vi.useRealTimers();
});

type SceneId = keyof typeof DELETED_BRANCH_SCENES;

const show = ({ id }: { readonly id: SceneId }) => {
  const Scene = DELETED_BRANCH_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the deleted branch scenes', () => {
  it('keeps the merged pull request of a branch that was deleted', async () => {
    show({ id: 'deleted-branch-merged-light' });

    await screen.findAllByText(/hl\/tenant-limits/, undefined, WAIT);
    expect(screen.queryByText('Not on a branch')).toBeNull();
    screen.getAllByText(/#309/);
    screen.getAllByText(/Merged/);
  });
});
