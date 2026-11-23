// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FACE_SWAP_ATTRIBUTE } from '@goodboy/ui';
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
import { U50_DESK_MOTION_SCENES } from './deskMotion';

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
  const Scene = U50_DESK_MOTION_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown desk motion scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  return screen.findByRole('tablist', { name: 'Overview or Desk' });
};

const stateOf = (key: string): string | null =>
  document.querySelector(`[data-pane-layer="${key}"]`)?.getAttribute('data-pane-state') ?? null;

describe('the u50 desk motion scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U50_DESK_MOTION_SCENES)).toEqual([
      'u50-desk-motion-dark',
      'u50-desk-motion-light',
    ]);
  });

  it('opens on the overview and swaps to the Desk through one face swap', async () => {
    await show({ name: 'u50-desk-motion-dark' });

    await screen.findByRole('complementary', { name: 'Desk' });
    await waitFor(() => expect(stateOf('overview')).toBe('hidden'));
    expect(stateOf('desk')).toBe('active');
    expect(document.body.hasAttribute(FACE_SWAP_ATTRIBUTE)).toBe(false);
  });

  it('swaps back to the overview from the Overview control', async () => {
    const control = await show({ name: 'u50-desk-motion-light' });
    await screen.findByRole('complementary', { name: 'Desk' });

    fireEvent.click(within(control).getByRole('tab', { name: /Overview/ }));

    await waitFor(() => expect(stateOf('overview')).toBe('active'));
    expect(stateOf('desk')).toBe('hidden');
  });
});
