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
import { U34_LAYOUT_FLOW_SCENES } from './layout-flows';

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
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(Object.entries(U34_LAYOUT_FLOW_SCENES))('mounts %s', async (id, Scene) => {
  const { container } = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  const title = await screen.findByRole('heading', { level: 1 });
  expect(title.textContent).toMatch(/limit check/);
  expect(title.textContent).not.toMatch(/webhooks/);
  expect(container.querySelector('[data-slot="branch-board"]')).not.toBeNull();
  if (id !== 'u34-u29-narrow-running') {
    expect(container.querySelector('[data-side-column], [data-column-rail]')).not.toBeNull();
  }
  if (id === 'u34-u30-active-tool') {
    const rail = screen.getByRole('toolbar', { name: 'Tools' });
    expect(rail.querySelector('[data-slot="tool-caption"][data-tone="open"]')?.textContent).toBe(
      'Agents',
    );
  }
});
