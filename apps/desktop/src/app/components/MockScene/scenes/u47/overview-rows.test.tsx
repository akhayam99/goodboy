// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U47_OVERVIEW_ROWS_SCENES } from './overview-rows';

const SETTLE_MS = 2_000;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

describe('the u47 overview rows scenes', () => {
  it('registers every scene', () => {
    for (const [name, Scene] of Object.entries(U47_OVERVIEW_ROWS_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(Scene);
    }
  });

  it('groups the branches of two projects and gives every branch its menu', async () => {
    const Scene = U47_OVERVIEW_ROWS_SCENES['u47-overview-rows-two-projects'];
    render(
      <ToastProvider>
        <ObjectMenuProvider>
          <Scene />
        </ObjectMenuProvider>
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });
    expect(screen.queryByText('Something went wrong')).toBeNull();
    const board = screen.getByRole('region', { name: 'Projects' });

    const projects = new Set(
      [...board.querySelectorAll('[data-board-project]')].map((section) =>
        section.getAttribute('data-board-project'),
      ),
    );
    expect([...projects].sort()).toEqual(['ledger-core', 'payments-api']);
    for (const tile of board.querySelectorAll<HTMLElement>('[data-board-row]')) {
      const project = tile.closest('[data-board-project]')?.getAttribute('data-board-project');
      const labels = within(tile)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label') ?? '');
      expect(labels.some((label) => label.startsWith(`${project ?? ''} · `))).toBe(true);
    }
  });
});
