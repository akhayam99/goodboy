// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U37_RUNS_ORDER_SCENES } from './runs-order';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U37_RUNS_ORDER_SCENES;

beforeAll(async () => {
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

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U37_RUNS_ORDER_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

describe('the u37 runs order scenes', () => {
  it('registers both themes', () => {
    expect(MOCK_SCENES['u37-runs-order']).toBeDefined();
    expect(MOCK_SCENES['u37-runs-order-light']).toBeDefined();
  });

  it.each(['u37-runs-order', 'u37-runs-order-light'] as const)(
    '%s folds the merged branch under a closed Finished row at the bottom',
    async (name) => {
      await mount(name);

      const grid = screen.getByRole('list', { name: 'Runs' });
      const headings = within(grid)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent);
      expect(headings.at(-1)).toBe('Finished');
      expect(within(grid).queryByRole('list', { name: 'fix/duplicate-credit' })).toBeNull();

      const finished = within(grid).getByRole('heading', { level: 2, name: 'Finished' });
      const toggle = within(finished.closest('li') ?? grid).getByRole('button', { name: 'Show' });
      fireEvent.click(toggle);
      within(grid).getByRole('list', { name: 'fix/duplicate-credit' });
    },
  );
});
