// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../store/storyHarness';
import { U34_BRANCH_TABS_SCENES } from './branch-tabs';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    db_select: [],
    db_execute: { rowsAffected: 0 },
    worktree_status: null,
    worktree_remote_url: null,
    worktree_diff_range: '',
    turn_quiet: [],
  });
});
afterEach(cleanup);

it('u34-u32-branch-tabs draws the Branch pages strip with six tabs on the page', async () => {
  const Scene = U34_BRANCH_TABS_SCENES['u34-u32-branch-tabs'];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );

  const strip = await screen.findByRole('tablist', { name: 'Branch pages' });
  expect(within(strip).getAllByRole('tab')).toHaveLength(6);
});
