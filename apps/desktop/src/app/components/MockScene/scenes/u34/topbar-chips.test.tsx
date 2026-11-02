// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../store/storyHarness';
import { U34_TOPBAR_CHIPS_SCENES } from './topbar-chips';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  stubStoryInvoke({
    db_select: [],
    db_execute: { rowsAffected: 0 },
    worktree_status: null,
    worktree_remote_url: null,
    turn_quiet: [],
  });
});
afterEach(cleanup);

it('u34-u55-topbar-running counts what runs in the top bar and never what needs you', async () => {
  const Scene = U34_TOPBAR_CHIPS_SCENES['u34-u55-topbar-running'];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );

  await waitFor(() => expect(document.querySelector('[data-top-bar]')).not.toBeNull());
  expect(document.querySelector('[data-top-bar] [data-now-needs-you]')).toBeNull();
  expect(screen.queryByText(/need you/)).toBeNull();
});
