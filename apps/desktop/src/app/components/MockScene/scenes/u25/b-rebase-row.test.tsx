// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../../store/slices/worktreeStatuses/cache';
import { U25_B_REBASE_ROW_SCENES } from './b-rebase-row';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  resetWorktreeStatusCache();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

type RenderSceneParams = {
  readonly name: keyof typeof U25_B_REBASE_ROW_SCENES;
};

const renderScene = ({ name }: RenderSceneParams) => {
  const Scene = U25_B_REBASE_ROW_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the rebase row scenes', () => {
  it('registers the three scenes', () => {
    expect(Object.keys(U25_B_REBASE_ROW_SCENES)).toEqual([
      'rebase-row-behind',
      'rebase-row-picker',
      'rebase-row-versions',
    ]);
  });

  it('reads how many commits main gained and offers Rebase onto latest', async () => {
    renderScene({ name: 'rebase-row-behind' });

    expect(await screen.findByText('15 new commits on main', {}, { timeout: 4000 })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Rebase onto latest' })).toBeDefined();
  });

  it('lists the other bases in the picker', async () => {
    renderScene({ name: 'rebase-row-picker' });

    expect(
      await screen.findByRole('option', { name: /release\/2\.4/ }, { timeout: 6000 }),
    ).toBeDefined();
    expect(screen.getByRole('option', { name: /develop/ })).toBeDefined();
  });

  it('opens the previous versions drawer with an expanded version', async () => {
    renderScene({ name: 'rebase-row-versions' });

    const drawer = await screen.findByRole(
      'region',
      { name: 'Previous versions' },
      { timeout: 4000 },
    );
    await waitFor(() => expect(drawer.textContent).toContain('Before a rebase'), { timeout: 4000 });
    expect(drawer.textContent).toContain('Reset branch to this version');
    await waitFor(() => expect(drawer.textContent).toContain('Hide commits'), { timeout: 8000 });
  }, 15000);
});
