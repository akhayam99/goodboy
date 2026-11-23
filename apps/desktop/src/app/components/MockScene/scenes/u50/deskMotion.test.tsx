// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { FACE_SWAP_ATTRIBUTE } from '@goodboy/ui';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { deskToolsOf } from '../../../../../features/session/components/SessionDesk/deskToolsOf';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U50_DESK_MOTION_SCENES } from './deskMotion';

let store: StoryStore;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  store = await importStore();
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
  vi.restoreAllMocks();
  document.body.removeAttribute(FACE_SWAP_ATTRIBUTE);
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
  return screen.findByRole('tablist', { name: 'Session pages' });
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
    expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(false);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: 1024, height: 700 }),
    );
    await show({ name: 'u50-desk-motion-dark' });

    await waitFor(() => expect(stateOf('overview')).toBe('leaving'));
    expect(document.querySelector('[data-pane-layer="overview"]')?.className).toContain(
      'animate-face-out',
    );
    expect(document.querySelector('[data-pane-layer="desk"]')?.hasAttribute('data-face-in')).toBe(
      true,
    );
    expect(document.body.getAttribute(FACE_SWAP_ATTRIBUTE)).toBe('desk');

    await waitFor(() => expect(document.body.hasAttribute(FACE_SWAP_ATTRIBUTE)).toBe(false), {
      timeout: 2000,
    });
    expect(stateOf('overview')).toBe('hidden');
    expect(stateOf('desk')).toBe('active');
    expect(document.querySelector('[data-pane-layer="desk"]')?.hasAttribute('data-face-in')).toBe(
      false,
    );
  });

  it('swaps back to the whole overview when the last tool closes', async () => {
    await show({ name: 'u50-desk-motion-light' });
    await screen.findByRole('complementary', { name: 'Desk' });

    act(() => {
      const state = store.getState();
      deskToolsOf({ state }).forEach((entry) => state.closeDrawerEntry({ entry }));
    });

    await waitFor(() => expect(stateOf('overview')).toBe('active'));
    expect(stateOf('desk')).toBe('hidden');
  });
});
