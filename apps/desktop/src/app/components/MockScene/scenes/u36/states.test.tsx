// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
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
import { U36_STATES_SCENES } from './states';

const WAIT = { timeout: 15_000 };

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

afterEach(cleanup);

type ShowParams = { readonly name: string };

const show = async ({ name }: ShowParams) => {
  const Scene = U36_STATES_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown u36 states scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
};

const WORDS = ['Stuck', 'Blocked', 'Working'];

describe('the u36 states scenes', () => {
  it('registers a light and a dark scene for each state', () => {
    const names = Object.keys(U36_STATES_SCENES);

    expect(names).toHaveLength(16);
    for (const name of names.filter((candidate) => candidate.endsWith('-light'))) {
      expect(names).toContain(name.replace(/-light$/, '-dark'));
    }
  });

  it.each(['light', 'dark'])(
    'u36-states-overview-needs-you-%s puts the stuck Auto under Needs you, never under Stuck',
    async (theme) => {
      await show({ name: `u36-states-overview-needs-you-${theme}` });

      const card = document.querySelector('[data-overview-card="needs-you"]');
      expect(card?.querySelector('[data-live-group="auto"]')?.getAttribute('data-state')).toBe(
        'waiting',
      );
      expect(card?.querySelector('[data-now-actions]')).not.toBeNull();
      for (const word of WORDS) {
        expect(document.body.textContent).not.toContain(word);
      }
    },
  );

  it.each(['light', 'dark'])(
    'u36-states-overview-failed-%s reads a timed out child as Needs you and keeps Stuck and Blocked off the screen',
    async (theme) => {
      await show({ name: `u36-states-overview-failed-${theme}` });

      const card = document.querySelector('[data-overview-card="needs-you"]');
      expect(card?.textContent).toContain('Needs you');
      for (const word of WORDS) {
        expect(document.body.textContent).not.toContain(word);
      }
    },
  );

  it.each(['light', 'dark'])(
    'u36-states-overview-noreply-%s reads an Auto that stopped replying as Failed, counted once',
    async (theme) => {
      await show({ name: `u36-states-overview-noreply-${theme}` });

      const auto = document.querySelector('[data-live-group="auto"]');
      expect(auto?.getAttribute('data-state')).toBe('failed');
      expect(auto?.textContent).toContain('Failed');
      expect(document.body.textContent).toContain('1 needs you');
      expect(document.body.textContent).not.toContain('1 stopped');
      expect(document.body.textContent).not.toContain('Auto failed');
      for (const word of WORDS) {
        expect(document.body.textContent).not.toContain(word);
      }
    },
  );

  it.each(['light', 'dark'])(
    'u36-states-overview-limit-%s reads an Auto blocked by its budget as Paused, never Failed',
    async (theme) => {
      await show({ name: `u36-states-overview-limit-${theme}` });

      const auto = document.querySelector('[data-live-group="auto"]');
      expect(auto?.getAttribute('data-state')).toBe('waiting');
      expect(auto?.textContent).toContain('Paused');
      expect(document.body.textContent).not.toContain('Failed');
      expect(document.body.textContent).not.toContain("couldn't reply");
      for (const word of WORDS) {
        expect(document.body.textContent).not.toContain(word);
      }
    },
  );

  it.each(['light', 'dark'])(
    'u36-states-auto-failed-%s says Failed for an Auto that stopped replying',
    async (theme) => {
      await show({ name: `u36-states-auto-failed-${theme}` });

      await waitFor(() => {
        expect(document.querySelector('[data-dock-line="failed"]')).not.toBeNull();
      }, WAIT);
      for (const word of WORDS) {
        expect(document.body.textContent).not.toContain(word);
      }
    },
  );

  it.each(['light', 'dark'])(
    'u36-states-auto-paused-%s says Paused at the limit',
    async (theme) => {
      await show({ name: `u36-states-auto-paused-${theme}` });

      await waitFor(() => {
        expect(document.body.textContent).toContain('Paused');
      }, WAIT);
      for (const word of WORDS) {
        expect(document.body.textContent).not.toContain(word);
      }
    },
  );
});
