// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../store/storyHarness';
import { U34_BOARD_PALETTE_SCENES } from './board-palette';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 }, worktree_status: null });
});
afterEach(cleanup);

it.each(Object.entries(U34_BOARD_PALETTE_SCENES))(
  'mounts %s with real controls',
  async (id, Scene) => {
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );
    if (id === 'u34-u53-palette') {
      const list = await screen.findByRole('listbox', { name: 'Commands' });
      expect(list.textContent).not.toMatch(/Delete/);
      return;
    }
    expect(await screen.findByRole('heading', { name: 'Sessions' })).toBeDefined();
    if (id === 'u34-u26-board') {
      const column = screen.getByLabelText('Sessions column');
      expect(column.style.width).toBe('244px');
      expect((column.parentElement as HTMLElement).style.width).toBe('1280px');
    }
  },
);
