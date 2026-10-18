// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U26S_EXPLORE_SCENES } from './ExploreScene';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

type SceneId = keyof typeof U26S_EXPLORE_SCENES;

const mount = ({ id }: { readonly id: SceneId }): void => {
  const Scene = U26S_EXPLORE_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the secondary Explore scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U26S_EXPLORE_SCENES).sort()).toEqual([
      'u26s-explore-drawer',
      'u26s-explore-empty',
      'u26s-explore-nomount',
      'u26s-explore-rows',
    ]);
    expect(MOCK_SCENES['u26s-explore-rows']).toBe(U26S_EXPLORE_SCENES['u26s-explore-rows']);
  });

  it('u26s-explore-rows shows the page header with the counts and the files', async () => {
    mount({ id: 'u26s-explore-rows' });

    await screen.findByRole('treeitem', { name: 'README.md' }, WAIT);
    expect(screen.getByRole('heading', { level: 1, name: 'Explore' })).toBeDefined();
    expect(screen.getByText('3 folders · 4 files')).toBeDefined();
    const header = document.querySelector<HTMLElement>('[data-page-header]');
    expect(header).not.toBeNull();
    expect(within(header ?? document.body).getByRole('button', { name: 'Close' })).toBeDefined();
  });

  it('u26s-explore-drawer keeps the title row and the files in a 400px column', async () => {
    mount({ id: 'u26s-explore-drawer' });

    await screen.findByRole('treeitem', { name: 'README.md' }, WAIT);
    expect(screen.getByRole('heading', { level: 1, name: 'Explore' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Refresh the files' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDefined();
  });

  it('u26s-explore-empty teaches what fills an empty folder', async () => {
    mount({ id: 'u26s-explore-empty' });

    expect(
      await screen.findByRole('heading', { name: 'This folder is empty' }, WAIT),
    ).toBeDefined();
    expect(
      screen.getByText('Files that agents write here show up as soon as they are saved.'),
    ).toBeDefined();
  });

  it('u26s-explore-nomount offers the one action', async () => {
    mount({ id: 'u26s-explore-nomount' });

    expect(await screen.findByRole('heading', { name: 'No folder to browse' }, WAIT)).toBeDefined();
    const offered = screen
      .getAllByRole('button', { name: 'Add folder' })
      .filter((button) => !button.hasAttribute('data-level-add'));
    expect(offered).toHaveLength(1);
    expect(offered[0]?.textContent).toBe('Add folder');
  });
});
