// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ContextMenu } from '../components/ContextMenu/ContextMenu';
import type { MenuEntry } from '../components/ContextMenu/menuTypes';

afterEach(cleanup);

type Select = (choice: string | null) => void;

const renderMenu = () => {
  const open: Mock<Select> = vi.fn<Select>();
  const editor: Mock<Select> = vi.fn<Select>();
  const rename: Mock<Select> = vi.fn<Select>();
  const onClose = vi.fn();
  const entries: ReadonlyArray<MenuEntry> = [
    {
      kind: 'item',
      key: 'goto',
      label: 'Go to',
      children: [
        { kind: 'item', key: 'open', label: 'Open', onSelect: open },
        {
          kind: 'item',
          key: 'editor',
          label: 'Open in editor',
          blockedReason: 'This session has no worktree yet',
          onSelect: editor,
        },
      ],
      onSelect: () => undefined,
    },
    { kind: 'item', key: 'rename', label: 'Rename', onSelect: rename },
  ];
  render(
    <ContextMenu
      label="Session actions"
      point={{ x: 20, y: 20 }}
      entries={entries}
      onClose={onClose}
    />,
  );
  return { open, editor, rename, onClose };
};

const focused = (): string => document.activeElement?.getAttribute('data-menu-label') ?? '';

const openGoTo = (): HTMLElement => {
  const parent = screen.getByRole('menuitem', { name: 'Go to' });
  parent.focus();
  fireEvent.keyDown(parent, { key: 'ArrowRight' });
  return parent;
};

describe('a menu row with a submenu', () => {
  it('opens on ArrowRight and focuses its first row', () => {
    renderMenu();
    expect(screen.queryByRole('menu', { name: 'Go to' })).toBeNull();
    openGoTo();
    screen.getByRole('menu', { name: 'Go to' });
    expect(focused()).toBe('Open');
  });

  it('closes on ArrowLeft and returns focus to the parent row', () => {
    renderMenu();
    const parent = openGoTo();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(screen.queryByRole('menu', { name: 'Go to' })).toBeNull();
    expect(document.activeElement).toBe(parent);
  });

  it('closes the whole menu on Escape', () => {
    const { onClose } = renderMenu();
    openGoTo();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves between its rows with the arrows without touching the parent list', () => {
    renderMenu();
    openGoTo();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(focused()).toBe('Open in editor');
  });

  it('runs a child and closes the menu', async () => {
    const { open, onClose } = renderMenu();
    openGoTo();
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Open' }));
    });
    expect(open).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps a blocked child listed with its reason and never runs it', () => {
    const { editor, onClose } = renderMenu();
    openGoTo();
    const row = screen.getByRole('menuitem', { name: 'Open in editor' });
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(row.getAttribute('aria-description')).toBe('This session has no worktree yet');
    fireEvent.click(row);
    expect(editor).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
