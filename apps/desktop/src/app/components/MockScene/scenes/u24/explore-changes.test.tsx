// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U24_EXPLORE_CHANGES_SCENES } from './explore-changes';

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

type SceneId = keyof typeof U24_EXPLORE_CHANGES_SCENES;

const mount = ({ id }: { readonly id: SceneId }): void => {
  const Scene = U24_EXPLORE_CHANGES_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the explore changes scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U24_EXPLORE_CHANGES_SCENES).sort()).toEqual([
      'explore-changedempty',
      'explore-changedfilter',
      'explore-changes',
      'explore-drawerchanges',
    ]);
    expect(MOCK_SCENES['explore-changes']).toBe(U24_EXPLORE_CHANGES_SCENES['explore-changes']);
  });

  it('explore-changes letters the changed files and dots the closed folders', async () => {
    mount({ id: 'explore-changes' });

    const rounding = await screen.findByRole('treeitem', { name: 'rounding.ts' }, WAIT);
    expect(within(rounding).getByLabelText('Modified').textContent).toBe('M');
    const batches = screen.getByRole('treeitem', { name: 'batches.csv' });
    expect(within(batches).getByLabelText('Added').textContent).toBe('A');
    const docs = screen.getByRole('treeitem', { name: 'docs' });
    expect(within(docs).getByLabelText('2 changed files')).toBeDefined();
    const src = screen.getByRole('treeitem', { name: 'src' });
    expect(within(src).queryByLabelText(/changed files?/)).toBeNull();
  });

  it('explore-changedfilter keeps only the changed paths and strikes the deleted file', async () => {
    mount({ id: 'explore-changedfilter' });

    const gone = await screen.findByRole('treeitem', { name: 'legacy-rounding.ts' }, WAIT);
    expect(gone.getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByRole('treeitem', { name: 'package.json' })).toBeNull();
    expect(screen.getByRole('treeitem', { name: 'schema.sql' })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Changed/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('explore-changedempty says nothing changed against main', async () => {
    mount({ id: 'explore-changedempty' });

    expect(await screen.findByText('No changes against main.', {}, WAIT)).toBeDefined();
  });

  it('explore-drawerchanges shows the diff of the file next to the tree', async () => {
    mount({ id: 'explore-drawerchanges' });

    expect(await screen.findByRole('tab', { name: 'Changes', selected: true }, WAIT)).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeDefined();
    expect(screen.queryByRole('tab', { name: 'Source' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Open in Files/ })).toBeNull();
    const drawer = screen.getByRole('region', { name: 'rounding.ts' });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Actions for rounding.ts' }));
    expect(screen.getByRole('menuitem', { name: 'Open in Files' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Copy path' })).toBeDefined();
  });
});
