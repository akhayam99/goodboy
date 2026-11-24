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
import { U50_OVERVIEW_SCENES } from './overview';

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
  const Scene = U50_OVERVIEW_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown overview scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await screen.findByRole('region', { name: 'Projects' });
};

describe('the u50 overview scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U50_OVERVIEW_SCENES)).toEqual([
      'u50-overview-light',
      'u50-overview-dark',
      'u50-overview-plain-light',
      'u50-overview-plain-dark',
    ]);
  });

  it.each(['u50-overview-light', 'u50-overview-dark'])(
    'opens %s on the quiet facts line, with no project state sentence',
    async (name) => {
      await show({ name });

      const column = document.querySelector('[data-central-column]');
      expect(column?.firstElementChild?.matches('[data-overview-facts]')).toBe(true);
      expect(screen.queryByText(/^(payments-api|ledger-core): /)).toBeNull();
    },
  );

  it('opens on one facts line and no tiles', async () => {
    await show({ name: 'u50-overview-light' });

    expect(document.querySelector('[data-overview-facts]')).toBeInstanceOf(HTMLElement);
    expect(document.querySelector('[data-slot="session-kpis"]')).toBeNull();
    screen.getByRole('button', { name: 'Hide dev details' });
  });

  it('draws the plain view with dev details off', async () => {
    await show({ name: 'u50-overview-plain-dark' });

    screen.getByRole('button', { name: 'Show dev details' });
    expect(document.querySelector('[data-board-diff]')).toBeNull();
  });
});
