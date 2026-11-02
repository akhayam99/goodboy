// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U34_PEEK_DRAWER_SCENES } from './peek-drawer';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
});

describe('identifier peek drawer scenes', () => {
  it('registers every state', () => {
    for (const [id, scene] of Object.entries(U34_PEEK_DRAWER_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(scene);
    }
  });

  it('shows the diff of a changed file', async () => {
    const Scene = U34_PEEK_DRAWER_SCENES['u34-peek-drawer-changed'];
    render(<Scene />);
    await screen.findByRole('grid', { name: 'Changes in src/ledger-core.ts' });
    expect(screen.queryByText('No changes on this branch')).toBeNull();
  });

  it('shows the source of an unchanged file with its note', async () => {
    const Scene = U34_PEEK_DRAWER_SCENES['u34-peek-drawer-unchanged'];
    render(<Scene />);
    await screen.findByText('No changes on this branch');
    await screen.findByText(/relay.send/);
  });

  it('orders the popover definition, changed, unchanged', async () => {
    const Scene = U34_PEEK_DRAWER_SCENES['u34-peek-popover-order'];
    render(<Scene />);
    const dialog = await screen.findByRole('dialog', { name: 'Uses of creditKey' });
    await within(dialog).findByRole('group', { name: 'Unchanged files' });
    expect(
      within(dialog)
        .getAllByRole('group')
        .map((group) => group.getAttribute('aria-label')),
    ).toEqual(['Defined in', 'Changed on this branch', 'Unchanged files']);
  });
});
