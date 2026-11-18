// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import type { ComponentType } from 'react';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../store/storyHarness';
import { U34_SETUP_CARD_SCENES } from './setup-card';

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

const mount = (Scene: ComponentType) =>
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );

it('u34-u27-foot-board keeps Settings, Report and the Goodboy mark at the foot of the rail, no setup line', async () => {
  mount(U34_SETUP_CARD_SCENES['u34-u27-foot-board']);

  const rail = await screen.findByRole('navigation', { name: 'Places' });
  within(rail).getByRole('button', { name: 'Settings' });
  within(rail).getByTestId('goodboy-chip');
  within(rail).getByRole('button', { name: 'Report a bug' });
  expect(rail.textContent).not.toContain('Setup');
});

it('u34-u27-empty-board draws the setup card on the empty board until it is hidden', async () => {
  mount(U34_SETUP_CARD_SCENES['u34-u27-empty-board']);

  const setup = await screen.findByRole('region', { name: 'Setup' });
  within(setup).getByRole('button', { name: 'Hide setup' });
  expect(screen.queryByText('No sessions yet')).not.toBeNull();
});

it('u34-u27-setup-card sits a section gap above what follows, with its action secondary and the done line last', async () => {
  mount(U34_SETUP_CARD_SCENES['u34-u27-setup-card']);

  const setup = await screen.findByRole('region', { name: 'Setup' });
  const card = document.querySelector('[data-slot="setup-card"]');
  expect(card?.getAttribute('data-rhythm')).toBe('section');
  within(setup).getByRole('meter', { name: 'Setup progress' });
  expect(setup.querySelectorAll('[data-variant="primary"]')).toHaveLength(0);
  expect(setup.querySelectorAll('[data-state="done"]')).toHaveLength(1);
  expect(within(setup).queryByText('Next')).toBeNull();
});
