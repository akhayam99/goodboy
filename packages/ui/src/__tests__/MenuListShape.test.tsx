// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Archive, Pencil, Pin, Trash2 } from '../icons';
import { MenuList } from '../components/ContextMenu/MenuList';
import type { MenuEntry, MenuItemEntry } from '../components/ContextMenu/menuTypes';

afterEach(cleanup);

type ItemParams = {
  readonly label: string;
  readonly icon?: MenuItemEntry['icon'];
};

const item = ({ label, icon }: ItemParams): MenuEntry => ({
  kind: 'item',
  key: label,
  label,
  ...(icon !== undefined && { icon }),
  onSelect: vi.fn(),
});

const separator = ({ key }: { readonly key: string }): MenuEntry => ({ kind: 'separator', key });

const iconCount = (): number =>
  screen.getAllByRole('menuitem').filter((row) => row.querySelector('svg') !== null).length;

describe('the shape MenuList draws', () => {
  it('draws no divider under five rows', () => {
    render(
      <MenuList
        label="File"
        entries={[
          item({ label: 'Open in editor', icon: Pencil }),
          separator({ key: 'one' }),
          item({ label: 'Show whole file', icon: Pin }),
          separator({ key: 'two' }),
          item({ label: 'Copy path', icon: Archive }),
        ]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryAllByRole('separator')).toHaveLength(0);
  });

  it('draws the dividers from five rows up', () => {
    render(
      <MenuList
        label="Session"
        entries={[
          item({ label: 'Rename', icon: Pencil }),
          item({ label: 'Pin', icon: Pin }),
          item({ label: 'Mark as read', icon: Pin }),
          separator({ key: 'end' }),
          item({ label: 'Archive', icon: Archive }),
          item({ label: 'Delete', icon: Trash2 }),
        ]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });

  it('shows an icon on every row or on none', () => {
    render(
      <MenuList
        label="Mixed"
        entries={[item({ label: 'Rename', icon: Pencil }), item({ label: 'Select' })]}
        onClose={vi.fn()}
      />,
    );

    expect(iconCount()).toBe(0);
    cleanup();
    render(
      <MenuList
        label="Every row"
        entries={[
          item({ label: 'Rename', icon: Pencil }),
          item({ label: 'Archive', icon: Archive }),
        ]}
        onClose={vi.fn()}
      />,
    );

    expect(iconCount()).toBe(2);
  });
});
