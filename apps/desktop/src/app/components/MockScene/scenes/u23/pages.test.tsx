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
import { U23_PAGES_SCENES } from './pages';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const menuRowsOf = async (name: keyof typeof U23_PAGES_SCENES): Promise<ReadonlyArray<string>> => {
  const Scene = U23_PAGES_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  const menu = await screen.findByRole('menu', { name: 'Switch page' }, { timeout: 4_000 });
  return within(menu)
    .getAllByRole('menuitemradio')
    .map((row) => row.textContent ?? '');
};

describe('the Pages menu scenes', () => {
  it('shows the five pages with their count words, Questions and the tools', async () => {
    const rows = await menuRowsOf('pages-menu');

    expect(rows).toEqual([
      'Overview',
      'Branch2 branches',
      'Runs1 running',
      'Agents1 running',
      'Artifacts4 artifacts',
      'Questions1 open',
      'Explore',
      'Scripts',
      'Terminal',
    ]);
  });

  it('shows empty count words and no Questions row when nothing waits', async () => {
    const rows = await menuRowsOf('pages-menu-quiet');

    expect(rows).toEqual([
      'Overview',
      'Branch',
      'Runs',
      'Agents',
      'Artifacts',
      'Explore',
      'Scripts',
      'Terminal',
    ]);
  });
});
