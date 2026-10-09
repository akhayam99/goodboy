// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OverflowMenu } from '../components/OverflowMenu';
import type { OverflowMenuItem } from '../components/MenuItems';

afterEach(cleanup);

const hover = (button: HTMLElement): void => {
  vi.useFakeTimers();
  fireEvent.mouseEnter(button);
  act(() => {
    vi.advanceTimersByTime(400);
  });
  vi.useRealTimers();
};

const ONE: OverflowMenuItem[] = [{ kind: 'item', key: 'one', label: 'One', onClick: vi.fn() }];

describe('OverflowMenu', () => {
  it('renders a trigger button with the default label', () => {
    render(<OverflowMenu items={ONE} />);
    expect(screen.getByRole('button', { name: /more actions/i })).toBeDefined();
  });

  it('explains the trigger through the shared tooltip, not a native title', () => {
    render(<OverflowMenu items={ONE} />);
    const trigger = screen.getByRole('button', { name: /more actions/i });
    expect(trigger.getAttribute('title')).toBeNull();
    hover(trigger);
    expect(screen.getByRole('tooltip').textContent).toBe('More actions');
  });

  it('lets the caller name the action in the tooltip', () => {
    render(
      <OverflowMenu items={ONE} label="Branch actions" tooltip="Rebase this branch, or push" />,
    );
    hover(screen.getByRole('button', { name: /branch actions/i }));
    expect(screen.getByRole('tooltip').textContent).toBe('Rebase this branch, or push');
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

  it('draws a 24px compact trigger by default and a 28px centred square on request', () => {
    const { rerender } = render(<OverflowMenu items={ONE} />);
    const compact = screen.getByRole('button', { name: /more actions/i });
    expect(compact.getAttribute('data-size')).toBe('compact');
    expect(compact.className.split(' ')).toContain('size-6');

    rerender(<OverflowMenu items={ONE} size="control" />);
    const control = screen.getByRole('button', { name: /more actions/i });
    expect(control.getAttribute('data-size')).toBe('control');
    expect(control.className.split(' ')).toContain('size-7');
  });

  it('draws the ellipsis glyph by default, never the vertical dots', () => {
    render(<OverflowMenu items={ONE} />);
    const glyph = screen.getByRole('button', { name: /more actions/i }).querySelector('svg');
    expect(glyph?.getAttribute('class')).toContain('lucide-ellipsis');
    expect(glyph?.getAttribute('class')).not.toContain('lucide-ellipsis-vertical');
  });

  it('draws nothing when it has no items', () => {
    const { container } = render(<OverflowMenu items={[]} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not open when disabled', () => {
    const items: OverflowMenuItem[] = [{ kind: 'item', key: 'x', label: 'X', onClick: vi.fn() }];
    render(<OverflowMenu items={items} disabled />);
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));
    expect(screen.queryByRole('menuitem')).toBeNull();
  });
});
