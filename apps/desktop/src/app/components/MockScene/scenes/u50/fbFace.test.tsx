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
import { U50_FB_FACE_SCENES } from './fbFace';

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
  const Scene = U50_FB_FACE_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown fb face scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  return screen.findByRole('tablist', { name: 'Session pages' });
};

describe('the u50 fb face scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U50_FB_FACE_SCENES)).toEqual([
      'u50-fb-face-overview-light',
      'u50-fb-face-overview-dark',
      'u50-fb-face-split-light',
      'u50-fb-face-split-dark',
    ]);
  });

  it('draws the whole overview under a head with no switch and no Changes tab', async () => {
    const tabs = await show({ name: 'u50-fb-face-overview-dark' });

    expect(within(tabs).queryByRole('tab', { name: /Changes/ })).toBeNull();
    expect(screen.queryByRole('tablist', { name: 'Overview or Desk' })).toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Desk' })).toBeNull();
    await screen.findByRole('region', { name: 'Projects' });
  });

  it('splits the page once a tool opens from the right rail', async () => {
    await show({ name: 'u50-fb-face-split-light' });

    await screen.findByRole('complementary', { name: 'Desk' });
    expect(screen.queryByRole('tablist', { name: 'Overview or Desk' })).toBeNull();
  });
});
