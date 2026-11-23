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
import { U50_DESK_NAV_SCENES } from './deskNav';

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  window.localStorage.clear();
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
  const Scene = U50_DESK_NAV_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown desk nav scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await screen.findByRole('tablist', { name: 'Session pages' });
};

describe('the u50 desk nav scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U50_DESK_NAV_SCENES)).toEqual([
      'u50-desk-nav-closed-light',
      'u50-desk-nav-closed-dark',
      'u50-desk-nav-elsewhere-light',
      'u50-desk-nav-elsewhere-dark',
      'u50-desk-nav-moved-light',
      'u50-desk-nav-moved-dark',
    ]);
  });

  it('draws the overview with Desk closed and Reopen', async () => {
    await show({ name: 'u50-desk-nav-closed-dark' });

    screen.getByText('Desk closed');
    screen.getByRole('button', { name: 'Reopen' });
    expect(screen.queryByRole('complementary', { name: 'Desk' })).toBeNull();
  });

  it('draws the two lines of a Desk held by another window', async () => {
    await show({ name: 'u50-desk-nav-elsewhere-light' });
    screen.getByText('Desk open in another window');
    screen.getByRole('button', { name: 'Bring it here' });
    cleanup();

    await show({ name: 'u50-desk-nav-moved-dark' });
    screen.getByText('Desk moved to another window');
    screen.getByRole('button', { name: 'Bring the Desk back' });
  });
});
