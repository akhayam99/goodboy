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
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U50_PR_ENTRY_SCENES } from './prEntry';

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

const show = ({ name }: Params) => {
  const Scene = U50_PR_ENTRY_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown pr entry scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the pr entry scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U50_PR_ENTRY_SCENES)).toEqual([
      'u50-pr-entry-checks-light',
      'u50-pr-entry-checks-dark',
      'u50-pr-entry-blocks-light',
      'u50-pr-entry-blocks-dark',
    ]);
  });

  it('opens Checks with the failing log under its row', async () => {
    show({ name: 'u50-pr-entry-checks-dark' });

    await waitFor(() =>
      expect(document.querySelector('[data-check-log] pre')?.textContent).toContain(
        'Received credits: 2',
      ),
    );
    screen.getByRole('button', { name: 'Open on GitHub' });
  });

  it('names the failing check on the branch chip of its block', async () => {
    show({ name: 'u50-pr-entry-blocks-light' });

    await screen.findByRole('region', { name: 'Projects' });
    const chips = [...document.querySelectorAll('[data-board-chip]')].map(
      (chip) => chip.textContent,
    );
    expect(chips.some((word) => word?.endsWith(' failed') === true)).toBe(true);
  });
});
