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
import { U24_EXPLORE_CHIP_SCENES } from './explore-chip';

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

type SceneId = keyof typeof U24_EXPLORE_CHIP_SCENES;

const mount = ({ id }: { readonly id: SceneId }): void => {
  const Scene = U24_EXPLORE_CHIP_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the explore chip scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U24_EXPLORE_CHIP_SCENES).sort()).toEqual([
      'explore-nomount',
      'explorefirstlap',
      'exploremulti',
    ]);
    expect(MOCK_SCENES['exploremulti']).toBe(U24_EXPLORE_CHIP_SCENES['exploremulti']);
  });

  it('exploremulti opens the menu with both projects and a check on the one shown', async () => {
    mount({ id: 'exploremulti' });

    const menu = await screen.findByRole('menu', { name: 'Projects' }, WAIT);
    const rows = within(menu).getAllByRole('menuitemradio');
    expect(rows).toHaveLength(2);
    expect(within(menu).getByRole('group', { name: 'payments-api' })).toBeDefined();
    expect(within(menu).getByRole('group', { name: 'notify-relay' })).toBeDefined();
    expect(rows.map((row) => row.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(await screen.findByRole('treeitem', { name: 'README.md' }, WAIT)).toBeDefined();
  });

  it('exploremulti browses the second project when you pick it', async () => {
    mount({ id: 'exploremulti' });

    const menu = await screen.findByRole('menu', { name: 'Projects' }, WAIT);
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /hl\/surface-retry/ }));

    expect(await screen.findByRole('treeitem', { name: 'retry-policy.md' }, WAIT)).toBeDefined();
    expect(screen.queryByRole('treeitem', { name: 'apps' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Project notify-relay, hl/surface-retry-state' }),
    ).toBeDefined();
  });

  it('explorefirstlap names the project folder and offers no menu', async () => {
    mount({ id: 'explorefirstlap' });

    await screen.findByRole('treeitem', { name: 'rounding.ts' }, WAIT);
    expect(screen.getByText('payments-api, project folder')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Project / })).toBeNull();
  });

  it('explore-nomount says there is nothing to browse yet and has no retry', async () => {
    mount({ id: 'explore-nomount' });

    expect(await screen.findByText('Nothing to browse yet', {}, WAIT)).toBeDefined();
    expect(screen.getByText('Files show here once this session has a project.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});
