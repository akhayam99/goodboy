// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U52_BOARD_SCENES } from './board';

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  window.localStorage.clear();
  await resetStoryStore();
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

const show = async ({ name }: Params): Promise<void> => {
  const Scene = U52_BOARD_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown u52 board scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await screen.findByRole('group', { name: 'building' });
};

const cardCount = (): number => document.querySelectorAll('[data-needs-you-card]').length;

describe('the u52 board scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U52_BOARD_SCENES)).toEqual([
      'u52-board-0-dark',
      'u52-board-0-light',
      'u52-board-3-dark',
      'u52-board-3-light',
      'u52-board-9-dark',
      'u52-board-9-light',
    ]);
  });

  it.each(['dark', 'light'])('draws no strip when nothing needs you in %s', async (theme) => {
    await show({ name: `u52-board-0-${theme}` });
    expect(screen.queryByRole('region', { name: 'Needs you' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'needs you' })).toBeNull();
  });

  it.each([
    ['3', 'dark', 3],
    ['3', 'light', 3],
    ['9', 'dark', 9],
    ['9', 'light', 9],
  ])('draws %s cards above the stages in %s', async (count, theme, expected) => {
    await show({ name: `u52-board-${count}-${theme}` });
    await screen.findByRole('region', { name: 'Needs you' });
    await waitFor(() => expect(cardCount()).toBe(expected));
    expect(screen.queryByRole('group', { name: 'needs you' })).toBeNull();
  });
});
