// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { STORAGE_KEYS } from '../../../../../shared/lib/storage-keys';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
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
  expect(container.querySelector('[data-running-rows]')).not.toBeNull();
  if (id !== 'u34-u29-narrow-running') {
    expect(container.querySelector('[data-side-column], [data-column-rail]')).not.toBeNull();
  }
  const isFourBranches = id.startsWith('u34-p18');
  expect(container.querySelectorAll('[data-live-where]').length > 0).toBe(isFourBranches);
  if (id === 'u34-p18-folded-branches-4') {
    screen.getByRole('button', { name: '4 more branches' });
  }
  if (id === 'u34-u30-active-tool') {
    const rail = screen.getByRole('toolbar', { name: 'Session tools' });
    expect(rail.querySelector('[data-slot="tool-caption"][data-tone="open"]')?.textContent).toBe(
      'Agents',
    );
  }
});

it('opens Agents at 1280, folds the rail, respects a manual unfold, and restores the fold on close', async () => {
  const observers = installFakeResizeObserver();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const isColumn = this.firstElementChild?.hasAttribute('data-drawer-main') === true;
    return DOMRect.fromRect({ width: isColumn ? 1034 : 0, height: 900 });
  });
  const Scene = U34_LAYOUT_FLOW_SCENES['u34-u28-drawer-closed'];
  const { container } = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await screen.findByRole('toolbar', { name: 'Session tools' });
  act(() => {
    observers.resizeAll();
  });
  const rail = screen.getByRole('navigation', { name: 'Session pages' });
  expect(rail.hasAttribute('data-rail-folded')).toBe(false);
  fireEvent.click(screen.getByTestId('pane-toggle-spawned'));
  expect(rail.hasAttribute('data-rail-folded')).toBe(true);
  expect(container.querySelector('[data-drawer-mode="push"]')).not.toBeNull();
  expect(localStorage.getItem(STORAGE_KEYS.sessionRailCollapsed)).toBe('0');
  fireEvent.click(screen.getByRole('button', { name: 'Show session pages' }));
  expect(rail.hasAttribute('data-rail-folded')).toBe(false);
  expect(container.querySelector('[data-drawer-mode="overlay"]')).not.toBeNull();
  expect(container.querySelector('[data-drawer-scrim]')).not.toBeNull();
  screen.getByText('Covers the page. Esc to go back');
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(rail.hasAttribute('data-rail-folded')).toBe(false);
  expect(localStorage.getItem(STORAGE_KEYS.sessionRailCollapsed)).toBe('0');
});
