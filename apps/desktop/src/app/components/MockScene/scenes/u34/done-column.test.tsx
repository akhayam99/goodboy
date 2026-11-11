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
import { U34_DONE_COLUMN_SCENES } from './done-column';

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

const doneToggle = (): HTMLElement => {
  const toggle = screen
    .getAllByRole('button', { name: /^Done/ })
    .find((button) => button.hasAttribute('aria-expanded'));
  if (toggle === undefined) {
    throw new Error('the column has no Done group');
  }
  return toggle;
};

const mount = (Scene: () => React.JSX.Element) =>
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );

it('u34-u19-column-done-closed shows the Board page and a shut Done group at the end of the column', async () => {
  mount(U34_DONE_COLUMN_SCENES['u34-u19-column-done-closed']);

  await screen.findByRole('heading', { name: 'Board' });
  const done = doneToggle();
  expect(done.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('tablist', { name: 'Sessions view' })).toBeNull();
  expect(screen.queryByRole('group', { name: 'building' })).not.toBeNull();
});

it('u34-u19-column-done-open lists the finished sessions under the open Done group', async () => {
  mount(U34_DONE_COLUMN_SCENES['u34-u19-column-done-open']);

  await screen.findByRole('heading', { name: 'Board' });
  const done = doneToggle();
  expect(done.getAttribute('aria-expanded')).toBe('true');
});
