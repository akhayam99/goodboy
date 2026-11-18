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

describe('the places rail and switcher scenes', () => {
  it('lights only the studio place on the rail while a studio sits over the session', async () => {
    show('session-studio-over');
    await screen.findByRole('button', { name: 'Tasks' });
    expect(marked()).toHaveLength(1);
    expect(marked()[0]?.getAttribute('data-shell-rail-item')).toBe('inbox');
  });

  it('lists the pinned sessions before the recent ones in the switcher', async () => {
    show('switcher-pinned');
    const pinned = within(await screen.findByRole('listbox', { name: 'Pinned' }));
    expect(pinned.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('listbox', { name: 'Recent sessions' })).toBeDefined();
  });
});
