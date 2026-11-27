// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../../store/storyHarness';
import { ATTN_NOISE_SCENES } from './attn-noise';

const WAIT = { timeout: 15_000 };
const pendingInvoke = () => new Promise<never>(() => undefined);

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    db_execute: pendingInvoke,
    db_select: pendingInvoke,
    worktree_status: pendingInvoke,
    worktree_remote_url: pendingInvoke,
    worktree_changed_files: pendingInvoke,
    project_git_status: pendingInvoke,
    check_provider_budget: pendingInvoke,
    workflow_list: pendingInvoke,
    turn_quiet: [],
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('attn-noise-seen', () => {
  it('offers Mark as read once the log rows are drawn', async () => {
    const Scene = ATTN_NOISE_SCENES['attn-noise-seen'];
    const view = render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    await vi.waitFor(() => {
      const label = [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Mark as read',
      );
      expect(label?.disabled).toBe(false);
    }, WAIT);
  });
});
