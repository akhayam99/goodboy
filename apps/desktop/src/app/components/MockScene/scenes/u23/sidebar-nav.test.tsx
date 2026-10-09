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
  it('marks the session row alone when Terminal is open', async () => {
    show('sidebar-terminal-current');
    await screen.findByRole('list', { name: 'Pages' });
    expect(marked()).toHaveLength(1);
    expect(marked()[0]?.getAttribute('data-current-sign')).toBe('session');
  });

  it('nests three branches under Branch, one with a pull request', async () => {
    show('sidebar-branches');
    const list = within(await screen.findByRole('list', { name: 'Branches' }));
    expect(list.getAllByRole('button')).toHaveLength(3);
    expect(
      list
        .getAllByRole('button')
        .filter((row) => /In review/.test(row.getAttribute('aria-label') ?? '')),
    ).toHaveLength(1);
  });

  it('shows five branches and All branches for six', async () => {
    show('sidebar-branches-many');
    const list = within(await screen.findByRole('list', { name: 'Branches' }));
    expect(list.getAllByRole('button')).toHaveLength(6);
    expect(list.getByText('All branches')).toBeDefined();
  });

  it('keeps the pages folded with a button that shows them', async () => {
    show('sidebar-pages-folded');
    await screen.findByRole('button', { name: /^Show the pages of/ });
    expect(screen.queryByRole('list', { name: 'Pages' })).toBeNull();
  });

  it('remembers the session without a sign while a studio sits over it', async () => {
    show('session-studio-over');
    await screen.findByRole('list', { name: 'Pages' });
    expect(document.querySelector('[data-current-sign="remembered"]')).not.toBeNull();
  });

  it('opens the flyout of the open session on hover', async () => {
    show('rail-flyout');
    const card = await screen.findByRole('dialog', { name: 'Session pages' }, { timeout: 4_000 });
    expect(within(card).getByRole('list', { name: 'Pages' })).toBeDefined();
    expect(within(card).getByRole('list', { name: 'Branches' })).toBeDefined();
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
