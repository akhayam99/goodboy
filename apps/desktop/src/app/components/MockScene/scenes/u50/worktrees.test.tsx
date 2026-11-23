// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U50_WORKTREES_SCENES } from './worktrees';

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
});

type Params = { readonly name: string };

const show = async ({ name }: Params) => {
  const Scene = U50_WORKTREES_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown worktrees scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await screen.findByRole('region', { name: 'Projects' });
};

describe('the worktrees scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U50_WORKTREES_SCENES)).toEqual([
      'u50-worktrees-light',
      'u50-worktrees-dark',
      'u50-worktrees-sheet-light',
      'u50-worktrees-sheet-dark',
    ]);
  });

  it('names the worktrees of the project and their weight on its block', async () => {
    await show({ name: 'u50-worktrees-light' });

    await screen.findByRole('button', {
      name: 'Worktrees in payments-api: 3 worktrees · 1.1 GB',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the sheet with one row per worktree and only the safe ones in the foot', async () => {
    await show({ name: 'u50-worktrees-sheet-dark' });

    const sheet = await screen.findByRole(
      'dialog',
      { name: 'Worktrees in payments-api' },
      { timeout: 2000 },
    );
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(3);
    within(sheet).getByText('Unsaved changes');
    within(sheet).getByText('2 ahead');
    within(sheet).getByRole('button', { name: 'Remove 2 safe · 528 MB' });
  });
});
