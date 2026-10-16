// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { U23_SIDEBAR_NAV_SCENES } from './sidebar-nav';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const show = (name: keyof typeof U23_SIDEBAR_NAV_SCENES) => {
  const Scene = U23_SIDEBAR_NAV_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const marked = () => Array.from(document.querySelectorAll('[aria-current="page"]'));

describe('the sidebar navigation scenes', () => {
  it('shows the workspace level with only the studio door marked while a studio sits over it', async () => {
    show('session-studio-over');
    await screen.findByRole('button', { name: 'Tasks' });
    expect(marked()).toHaveLength(1);
    expect(marked()[0]?.getAttribute('data-column-door')).toBe('inbox');
  });

  it('opens the flyout of the open session on hover', async () => {
    show('rail-flyout');
    const card = await screen.findByRole('dialog', { name: 'Session pages' }, { timeout: 4_000 });
    expect(within(card).getByRole('list', { name: 'Pages' })).toBeDefined();
    expect(within(card).getByText('Pinned')).toBeDefined();
  });

  it('shows seven pinned buttons then +2', async () => {
    show('rail-pinned');
    const more = await screen.findByLabelText('2 more pinned sessions');
    expect(more.textContent).toBe('+2');
    expect(document.querySelectorAll('[data-rail-session]')).toHaveLength(8);
  });

  it('marks New with the draft dot', async () => {
    show('rail-draft-dot');
    await screen.findByRole('button', { name: 'New session, draft in progress' });
    expect(document.querySelector('[data-slot="draft-dot"]')).not.toBeNull();
  });

  it('lists the pinned sessions before the recent ones in the switcher', async () => {
    show('switcher-pinned');
    const pinned = within(await screen.findByRole('listbox', { name: 'Pinned' }));
    expect(pinned.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('listbox', { name: 'Recent sessions' })).toBeDefined();
  });
});
