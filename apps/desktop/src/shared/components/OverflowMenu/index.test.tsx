// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OverflowMenu, type OverflowMenuItem } from './index';

afterEach(cleanup);

describe('OverflowMenu', () => {
  it('renders a trigger button with the default label', () => {
    render(<OverflowMenu items={[]} />);
    expect(screen.getByRole('button', { name: /more actions/i })).toBeDefined();
  });

  it('opens the menu on trigger click and shows item labels', () => {
    const items: OverflowMenuItem[] = [
      { kind: 'item', key: 'rename', label: 'Rename', onClick: vi.fn() },
      { kind: 'separator', key: 'sep1' },
      { kind: 'item', key: 'delete', label: 'Delete', onClick: vi.fn(), destructive: true },
    ];
    render(<OverflowMenu items={items} />);
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));
    expect(screen.getByRole('menuitem', { name: /rename/i })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: /delete/i })).toBeDefined();
  });

  it('fires onClick and closes the menu when an item is selected', () => {
    const onSelect = vi.fn();
    const items: OverflowMenuItem[] = [
      { kind: 'item', key: 'foo', label: 'Run foo', onClick: onSelect },
    ];
    render(<OverflowMenu items={items} />);
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /run foo/i }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('escapes clipping ancestors by rendering the menu in a fixed portal', () => {
    const items: OverflowMenuItem[] = [{ kind: 'item', key: 'x', label: 'X', onClick: vi.fn() }];
    render(
      <div className="overflow-x-auto">
        <OverflowMenu items={items} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));
    const menu = screen.getByRole('menu');
    expect(menu.className).toContain('fixed');
    expect(menu.closest('[data-dropdown-portal]')).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'X' })).toBeDefined();
  });

  it('does not open when disabled', () => {
    const items: OverflowMenuItem[] = [{ kind: 'item', key: 'x', label: 'X', onClick: vi.fn() }];
    render(<OverflowMenu items={items} disabled />);
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));
    expect(screen.queryByRole('menuitem')).toBeNull();
  });
});
