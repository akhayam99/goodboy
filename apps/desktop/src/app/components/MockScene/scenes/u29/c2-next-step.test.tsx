// @vitest-environment happy-dom

vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 29, 10, 31));
});
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../store/storyHarness';
import { U29_C2_NEXT_STEP_SCENES } from './c2-next-step';

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

describe('the next step card scene', () => {
  it('shows one card with the primary, two alternatives, a hint behind Add a hint and no Confirm row', async () => {
    const Scene = U29_C2_NEXT_STEP_SCENES['c2-next-step'];
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    const card = await screen.findByRole('region', { name: 'Next step' }, WAIT);
    expect(card.querySelectorAll('[role="option"]')).toHaveLength(3);
    expect(screen.queryByRole('textbox', { name: 'Add a hint' })).toBeNull();
    screen.getByRole('button', { name: 'Add a hint' });
    expect(screen.queryByRole('group', { name: 'Confirm this work' })).toBeNull();
  });
});
