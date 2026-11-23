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
import { U50_TERMINAL_DESK_SCENES } from './terminalDesk';

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
  const Scene = U50_TERMINAL_DESK_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown terminal desk scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  return screen.findByRole('tablist', { name: 'Worktrees' });
};

describe('the u50 terminal desk scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U50_TERMINAL_DESK_SCENES)).toEqual([
      'u50-terminal-desk-peek-light',
      'u50-terminal-desk-peek-dark',
      'u50-terminal-desk-light',
      'u50-terminal-desk-dark',
    ]);
  });

  it('splits the overview into the Desk when the terminal opens, a tab per track', async () => {
    const tracks = await show({ name: 'u50-terminal-desk-peek-dark' });

    expect(
      within(tracks)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['payments-api', 'ledger-core']);
    await screen.findByRole('complementary', { name: 'Desk' });
    expect(screen.queryByRole('button', { name: 'Open on desk' })).toBeNull();
  });

  it('draws the terminal on the Desk with no Open on desk', async () => {
    await show({ name: 'u50-terminal-desk-light' });

    expect(screen.queryByRole('button', { name: 'Open on desk' })).toBeNull();
  });
});
