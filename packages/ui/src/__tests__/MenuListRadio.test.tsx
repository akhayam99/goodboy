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

  it('shows a choice hint after its label and keeps typeahead on the label', () => {
    render(
      <MenuList
        label="Filter"
        entries={[
          {
            kind: 'radio',
            key: 'show',
            label: 'Show',
            choices: [
              { id: 'all', label: 'All', isCurrent: true },
              { id: 'unviewed', label: 'Unviewed', isCurrent: false, hint: '3' },
            ],
            onSelect: vi.fn(),
          },
        ]}
        onClose={vi.fn()}
      />,
    );
    const row = screen.getByRole('menuitemradio', { name: /^Unviewed/ });

    expect(row.textContent).toBe('Unviewed3');
    expect(row.getAttribute('data-menu-label')).toBe('Unviewed');
    fireEvent.keyDown(screen.getByRole('menu', { name: 'Filter' }), { key: 'u' });
    expect(document.activeElement).toBe(row);
  });

  it('describes a choice that carries a tooltip', () => {
    render(
      <MenuList
        label="Autonomy"
        entries={[
          {
            kind: 'radio',
            key: 'autonomy',
            label: 'Autonomy',
            choices: [
              { id: 'step', label: 'Ask me', isCurrent: true, tooltip: 'Pauses every step.' },
              { id: 'run', label: 'Autopilot', isCurrent: false },
            ],
            onSelect: vi.fn(),
          },
        ]}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('menuitemradio', { name: 'Ask me' }).getAttribute('aria-description'),
    ).toBe('Pauses every step.');
    expect(
      screen.getByRole('menuitemradio', { name: 'Autopilot' }).hasAttribute('aria-description'),
    ).toBe(false);
  });

  it('leaves closing to the owner of an entry that should stay open', () => {
    const onPick = vi.fn<Choose>();
    const onMove = vi.fn<(choice: string | null) => void>();
    const onClose = vi.fn<() => void>();
    render(
      <MenuList
        label="Issue"
        entries={[
          {
            kind: 'radio',
            key: 'assignee',
            label: 'Assign to',
            choices: [{ id: 'ada', label: 'Ada Lovelace', isCurrent: false }],
            shouldStayOpen: true,
            onSelect: onPick,
          },
          {
            kind: 'item',
            key: 'move',
            label: 'Start progress',
            shouldStayOpen: true,
            onSelect: onMove,
          },
        ]}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Ada Lovelace' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Start progress' }));

    expect(onPick).toHaveBeenCalledWith('ada');
    expect(onMove).toHaveBeenCalledWith(null);
    expect(onClose).not.toHaveBeenCalled();
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
