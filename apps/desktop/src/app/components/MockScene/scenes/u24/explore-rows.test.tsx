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
import { U24_EXPLORE_ROWS_SCENES } from './explore-rows';

const WAIT = { timeout: 15_000 };
const MAX_ROWS_IN_DOM = 80;

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

type SceneId = keyof typeof U24_EXPLORE_ROWS_SCENES;

const mount = ({ id }: { readonly id: SceneId }): void => {
  const Scene = U24_EXPLORE_ROWS_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the explore row scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U24_EXPLORE_ROWS_SCENES).sort()).toEqual([
      'explore-rows',
      'explore-rows-big',
      'explore-rows-compact',
      'explore-rows-empty',
      'explore-rows-keys',
      'explore-rows-narrow',
    ]);
    expect(MOCK_SCENES['explore-rows']).toBe(U24_EXPLORE_ROWS_SCENES['explore-rows']);
  });

  it('explore-rows opens the repository and shows size and age on each file', async () => {
    mount({ id: 'explore-rows' });

    const rounding = await screen.findByRole('treeitem', { name: 'rounding.ts' }, WAIT);
    expect(rounding.getAttribute('aria-level')).toBe('3');
    expect(within(rounding).getByText('4.0 KB')).toBeDefined();
    expect(within(rounding).getByText('1h ago')).toBeDefined();
    expect(screen.getByRole('treeitem', { name: 'apps' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(screen.getByRole('treeitem', { name: 'package.json' })).toBeDefined();
  });

  it('explore-rows-keys rests the focus on a row of the tree', async () => {
    mount({ id: 'explore-rows-keys' });

    const row = await screen.findByRole('treeitem', { name: 'rounding.test.ts' }, WAIT);
    await vi.waitFor(() => expect(document.activeElement).toBe(row), WAIT);
    expect(row.tabIndex).toBe(0);
  });

  it('explore-rows-narrow and explore-rows-compact keep the rows in a narrower column', async () => {
    mount({ id: 'explore-rows-narrow' });
    await screen.findByRole('treeitem', { name: 'rounding.ts' }, WAIT);
    cleanup();

    mount({ id: 'explore-rows-compact' });
    await screen.findByRole('treeitem', { name: 'rounding.ts' }, WAIT);
    expect(screen.getByRole('tree', { name: 'Files' })).toBeDefined();
  });

  it('explore-rows-big windows a folder of 3,000 entries', async () => {
    mount({ id: 'explore-rows-big' });

    await screen.findByRole('treeitem', { name: 'pkg-0000.js' }, WAIT);
    expect(screen.getAllByRole('treeitem').length).toBeLessThan(MAX_ROWS_IN_DOM);
  });

  it('explore-rows-empty says the folder is empty', async () => {
    mount({ id: 'explore-rows-empty' });

    expect(await screen.findByText('This folder is empty', {}, WAIT)).toBeDefined();
  });
});
