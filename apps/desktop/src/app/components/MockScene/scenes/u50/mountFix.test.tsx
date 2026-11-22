// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
import { U50_MOUNT_FIX_SCENES } from './mountFix';

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
  const Scene = U50_MOUNT_FIX_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown mount fix scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await screen.findByRole('region', { name: 'Projects' });
};

describe('the mount fix scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U50_MOUNT_FIX_SCENES)).toEqual([
      'u50-mount-fix-light',
      'u50-mount-fix-dark',
      'u50-mount-fix-confirm-light',
      'u50-mount-fix-confirm-dark',
    ]);
  });

  it('puts Remove from session on the project head of the board', async () => {
    await show({ name: 'u50-mount-fix-light' });

    screen.getByRole('button', { name: 'Remove payments-api from session' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the removal question from the project menu verb', async () => {
    await show({ name: 'u50-mount-fix-confirm-dark' });

    await screen.findByRole(
      'dialog',
      { name: 'Remove payments-api from the session?' },
      { timeout: 2000 },
    );
  });
});
