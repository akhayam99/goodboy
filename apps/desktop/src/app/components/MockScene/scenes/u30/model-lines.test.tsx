// @vitest-environment happy-dom

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
import { MOCK_SCENES } from '../..';
import { U30_MODEL_LINES_SCENES } from './model-lines';

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

describe('the u30 model lines scene', () => {
  it('registers the scene for the capture', () => {
    const Scene = U30_MODEL_LINES_SCENES['u30-model-lines'];
    expect(MOCK_SCENES['u30-model-lines']).toBe(Scene);
  });

  it('shows the model by name with its effort on every child card and every rail row', async () => {
    const Scene = U30_MODEL_LINES_SCENES['u30-model-lines'];
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    const cards = await screen.findAllByRole('status', undefined, WAIT);
    const lines = document.querySelectorAll('[data-auto-child-card] [data-model-line]');
    expect(lines.length).toBeGreaterThan(0);
    expect(cards.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.textContent).toMatch(/^(Opus|Sonnet) 5\.5 (High|Medium|Low)$/);
    }
    const tree = await screen.findByRole('tree', { name: 'Auto agents' }, WAIT);
    const rowLines = Array.from(
      tree.querySelectorAll('[data-spawned-state-row] [data-model-line]'),
    );
    expect(rowLines.length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/sonnet-5\.5|opus-5\.5/);
  });
});
