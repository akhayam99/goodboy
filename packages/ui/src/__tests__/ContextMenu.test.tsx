// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Archive, Cpu, Trash2 } from 'lucide-react';
import { ContextMenu } from '../components/ContextMenu/ContextMenu';
import { placeContextMenu } from '../components/ContextMenu/placeContextMenu';
import { OverflowMenu } from '../components/OverflowMenu';
import type { MenuEntry } from '../components/ContextMenu/menuTypes';

afterEach(cleanup);

type Select = (choice: string | null) => void;

type Spies = {
  readonly archive: Mock<Select>;
  readonly remove: Mock<Select>;
  readonly model: Mock<Select>;
  readonly blocked: Mock<Select>;
};

const entriesFor = (spies: Spies): ReadonlyArray<MenuEntry> => [
  {
    kind: 'item',
    key: 'archive',
    label: 'Archive',
    icon: Archive,
    hint: '⌘⇧A',
    onSelect: spies.archive,
  },
  {
    kind: 'item',
    key: 'model',
    label: 'Change model',
    icon: Cpu,
    choices: [
      { id: 'opus', label: 'Opus 5.5', isCurrent: true },
      { id: 'sonnet', label: 'Sonnet 5', isCurrent: false },
    ],
    onSelect: spies.model,
  },
  {
    kind: 'item',
    key: 'diff',
    label: 'Diff',
    blockedReason: 'Add a project to this session first',
    onSelect: spies.blocked,
  },
  { kind: 'separator', key: 'danger' },
  {
    kind: 'item',
    key: 'delete',
    label: 'Delete',
    icon: Trash2,
    isDestructive: true,
    confirm: {
      title: 'Delete session?',
      description: 'Removes the Harborline payout export session.',
      confirmLabel: 'Delete',
      role: 'danger',
    },
    onSelect: spies.remove,
  },
];

const renderMenu = () => {
  const spies: Spies = {
    archive: vi.fn<Select>(),
    remove: vi.fn<Select>(),
    model: vi.fn<Select>(),
    blocked: vi.fn<Select>(),
  };
  const onClose = vi.fn();
  render(
    <ContextMenu
      label="Session actions"
      point={{ x: 20, y: 20 }}
      entries={entriesFor(spies)}
      onClose={onClose}
    />,
  );
  return { spies, onClose };
};

const focused = (): string => document.activeElement?.getAttribute('data-menu-label') ?? '';

describe('ContextMenu', () => {
  it('opens at the pointer with the first row focused and arrows moving through rows', () => {
    renderMenu();
    expect(screen.getByRole('menu', { name: 'Session actions' })).toBeDefined();
    expect(focused()).toBe('Archive');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(focused()).toBe('Change model');
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(focused()).toBe('Delete');
  });

  it('jumps to the first row that starts with the typed letters', () => {
    renderMenu();
    fireEvent.keyDown(document.activeElement!, { key: 'd' });
    expect(focused()).toBe('Diff');
    fireEvent.keyDown(document.activeElement!, { key: 'e' });
    expect(focused()).toBe('Delete');
  });

  it('runs a plain row and closes', async () => {
    const { spies, onClose } = renderMenu();
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /Archive/ }));
    });
    expect(spies.archive).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps a blocked row visible with its reason and never runs it', () => {
    const { spies, onClose } = renderMenu();
    const row = screen.getByRole('menuitem', { name: /Diff/ });
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(row.textContent).toContain('Add a project to this session first');
    fireEvent.click(row);
    expect(spies.blocked).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('morphs into an inline confirm inside the menu before a destructive row runs', async () => {
    const { spies } = renderMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    expect(screen.getByText('Delete session?')).toBeDefined();
    expect(spies.remove).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });
    expect(spies.remove).toHaveBeenCalledTimes(1);
  });

  it('cancels the confirm on Escape before it closes the menu', () => {
    const { onClose } = renderMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    fireEvent.keyDown(screen.getByText('Delete session?'), { key: 'Escape' });
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('opens one submenu level with ArrowRight and runs the chosen value', async () => {
    const { spies } = renderMenu();
    const row = screen.getByRole('menuitem', { name: /Change model/ });
    row.focus();
    fireEvent.keyDown(row, { key: 'ArrowRight' });
    const current = screen.getByRole('menuitemradio', { name: 'Opus 5.5' });
    expect(current.getAttribute('aria-checked')).toBe('true');
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Sonnet 5' }));
    });
    expect(spies.model).toHaveBeenCalledWith('sonnet');
  });

  it('closes on a click outside', () => {
    const { onClose } = renderMenu();
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('placeContextMenu', () => {
  const viewport = { width: 1000, height: 800 };

  it('keeps the menu at the pointer when it fits', () => {
    expect(
      placeContextMenu({ point: { x: 100, y: 100 }, width: 200, height: 300, viewport }),
    ).toEqual({
      x: 100,
      y: 100,
    });
  });

  it('flips left and up so the menu stays 8px inside the window', () => {
    expect(
      placeContextMenu({ point: { x: 900, y: 700 }, width: 200, height: 300, viewport }),
    ).toEqual({
      x: 700,
      y: 400,
    });
  });
});

describe('MenuItems keyboard', () => {
  it('moves through a ⋯ menu with the arrow keys', () => {
    render(
      <OverflowMenu
        items={[
          { kind: 'item', key: 'a', label: 'Open in editor', onClick: vi.fn() },
          { kind: 'item', key: 'b', label: 'Copy path', onClick: vi.fn() },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));
    expect(document.activeElement?.textContent).toBe('Open in editor');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toBe('Copy path');
  });
});
