// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MenuList } from '../components/ContextMenu/MenuList';
import type { MenuEntry } from '../components/ContextMenu/menuTypes';

afterEach(cleanup);

type Choose = (choice: string) => void;

type EntriesParams = {
  readonly onShape: Mock<Choose>;
  readonly onDefault: Mock<(choice: string | null) => void>;
  readonly isDisabled: boolean;
};

const entriesFor = ({
  onShape,
  onDefault,
  isDisabled,
}: EntriesParams): ReadonlyArray<MenuEntry> => [
  {
    kind: 'radio',
    key: 'shape',
    label: 'Run it as',
    choices: [
      { id: 'plan', label: 'A plan', isCurrent: true },
      { id: 'lead', label: 'One agent', isCurrent: false },
    ],
    isDisabled,
    onSelect: onShape,
  },
  { kind: 'item', key: 'default', label: 'Make it the default', onSelect: onDefault },
];

type RenderParams = {
  readonly isDisabled?: boolean;
};

const renderMenu = ({ isDisabled = false }: RenderParams = {}) => {
  const onShape = vi.fn<Choose>();
  const onDefault = vi.fn<(choice: string | null) => void>();
  const onClose = vi.fn<() => void>();
  render(
    <MenuList
      label="Route"
      entries={entriesFor({ onShape, onDefault, isDisabled })}
      onClose={onClose}
    />,
  );
  return { onShape, onDefault, onClose };
};

describe('a radio group in MenuList', () => {
  it('draws one checked choice inside a labeled group', () => {
    renderMenu();

    const group = screen.getByRole('group', { name: 'Run it as' });
    expect(
      within(group)
        .getAllByRole('menuitemradio')
        .map((row) => row.getAttribute('aria-checked')),
    ).toEqual(['true', 'false']);
    expect(screen.getByRole('menuitemradio', { name: 'A plan' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('moves through radio rows and plain rows with the same arrow keys', () => {
    renderMenu();
    const menu = screen.getByRole('menu', { name: 'Route' });

    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'A plan' }));
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'One agent' }));
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(
      screen.getByRole('menuitem', { name: 'Make it the default' }),
    );
    fireEvent.keyDown(menu, { key: 'o' });
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'One agent' }));
  });

  it('closes and runs the chosen value', () => {
    const { onShape, onClose } = renderMenu();

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'One agent' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onShape).toHaveBeenCalledWith('lead');
  });

  it('keeps a disabled group visible, marked disabled, and never runs it', () => {
    const { onShape, onClose } = renderMenu({ isDisabled: true });
    const row = screen.getByRole('menuitemradio', { name: 'One agent' });

    fireEvent.click(row);

    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(onShape).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
