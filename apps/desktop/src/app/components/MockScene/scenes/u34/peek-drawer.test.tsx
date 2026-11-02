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
    const header = document.querySelector('[data-slot="explore-file-meta"]');
    expect(header?.textContent).toBe('apps/notify-relay/src/credits.ts');
    expect(header?.textContent).not.toContain(' B');
    expect(screen.queryByRole('button', { name: /details/i })).toBeNull();
  });

  it('lists the changed definition file once with one selected row', async () => {
    const Scene = U34_PEEK_DRAWER_SCENES['u34-peek-drawer-changed'];
    render(<Scene />);
    await screen.findByRole('grid', { name: 'Changes in src/ledger-core.ts' });
    const rows = screen
      .getAllByRole('button')
      .filter((button) => /^[\w/.-]+:\d+$/.test(button.getAttribute('aria-label') ?? ''));
    const paths = rows.map((row) => (row.getAttribute('aria-label') ?? '').replace(/:\d+$/, ''));
    expect(new Set(paths).size).toBe(paths.length);
    expect(rows.filter((row) => row.getAttribute('aria-current') === 'true')).toHaveLength(1);
    within(screen.getByRole('group', { name: 'Defined in' })).getByText('Changed');
    expect(screen.queryByRole('group', { name: 'Changed on this branch' })).toBeNull();
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

  it('shows a path once and never truncates a file name in the popover', async () => {
    const Scene = U34_PEEK_DRAWER_SCENES['u34-peek-popover-order'];
    render(<Scene />);
    const dialog = await screen.findByRole('dialog', { name: 'Uses of creditKey' });
    await within(dialog).findByRole('group', { name: 'Unchanged files' });
    const groupOf = (name: string) => {
      const group = within(dialog).queryByRole('group', { name });
      return group === null ? [] : within(group).queryAllByRole('button');
    };
    const definitionPaths = new Set(
      groupOf('Defined in').map((row) =>
        (row.getAttribute('aria-label') ?? '').replace(/:\d+$/, ''),
      ),
    );
    for (const name of ['Changed on this branch', 'Unchanged files']) {
      for (const row of groupOf(name)) {
        expect(
          definitionPaths.has((row.getAttribute('aria-label') ?? '').replace(/:\d+$/, '')),
        ).toBe(false);
      }
    }
    const names = dialog.querySelectorAll('[data-peek-name]');
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name.hasAttribute('data-truncates')).toBe(false);
    }
    for (const directory of dialog.querySelectorAll('[data-peek-directory]')) {
      expect(directory.hasAttribute('data-truncates')).toBe(true);
    }
  });
});
