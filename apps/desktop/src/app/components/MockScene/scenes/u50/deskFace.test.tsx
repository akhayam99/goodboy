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
import { U50_DESK_FACE_SCENES } from './deskFace';

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
  const Scene = U50_DESK_FACE_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown desk face scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  return screen.findByRole('tablist', { name: 'Overview or Desk' });
};

const litFace = (control: HTMLElement): string | null =>
  within(control)
    .getAllByRole('tab')
    .find((tab) => tab.getAttribute('aria-selected') === 'true')?.textContent ?? null;

describe('the u50 desk face scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U50_DESK_FACE_SCENES)).toEqual([
      'u50-desk-face-light',
      'u50-desk-face-dark',
      'u50-desk-face-overview-light',
      'u50-desk-face-overview-dark',
    ]);
  });

  it('draws the Desk with its column under the one session head', async () => {
    const control = await show({ name: 'u50-desk-face-dark' });

    expect(litFace(control)).toBe('Desk');
    await screen.findByRole('complementary', { name: 'Desk' });
    expect(document.querySelectorAll('[data-session-head]').length).toBe(1);
  });

  it('draws the overview face with Overview lit in the same place', async () => {
    const control = await show({ name: 'u50-desk-face-overview-light' });

    expect(litFace(control)).toBe('Overview');
    expect(screen.queryByRole('complementary', { name: 'Desk' })).toBeNull();
  });
});
