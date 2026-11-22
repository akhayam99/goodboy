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
import { U50_DESK_OWNS_SCENES } from './deskOwns';

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

const show = ({ name }: Params) => {
  const Scene = U50_DESK_OWNS_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown desk owns scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u50 desk owns scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U50_DESK_OWNS_SCENES)).toEqual([
      'u50-desk-owns-asleep-light',
      'u50-desk-owns-asleep-dark',
      'u50-desk-owns-awake-light',
      'u50-desk-owns-awake-dark',
    ]);
  });

  it('draws the Browser on the Desk with the asleep page and Wake', async () => {
    show({ name: 'u50-desk-owns-asleep-dark' });

    await screen.findByText('localhost:4010 · asleep');
    screen.getByRole('button', { name: 'Wake' });
  });

  it('draws a page that was only hidden with no card', async () => {
    show({ name: 'u50-desk-owns-awake-light' });

    await screen.findByRole('region', { name: /^Page:/ });
    expect(screen.queryByRole('button', { name: 'Wake' })).toBeNull();
  });
});
