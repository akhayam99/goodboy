// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AnchoredPopover } from '../components/AnchoredPopover';
import { useDropdown } from '../useDropdown';

afterEach(cleanup);

type HarnessProps = {
  readonly hasBackdrop?: boolean;
};

const Harness = ({ hasBackdrop }: HarnessProps) => {
  const dropdown = useDropdown({ width: 'w-52' });
  return (
    <div className="overflow-hidden">
      <AnchoredPopover
        dropdown={dropdown}
        role="menu"
        ariaLabel="Test menu"
        hasBackdrop={hasBackdrop}
        trigger={
          <button type="button" onClick={dropdown.toggle} aria-expanded={dropdown.open}>
            Open
          </button>
        }
      >
        <button type="button" onClick={dropdown.close}>
          Item
        </button>
      </AnchoredPopover>
      <button type="button">Outside</button>
    </div>
  );
};

describe('AnchoredPopover', () => {
  it('opens on trigger click and closes on a second click', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('menu')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('escapes clipping ancestors through a body portal on the fixed layer', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const menu = screen.getByRole('menu');
    expect(menu.className).toContain('fixed');
    expect(menu.className).toContain('z-popover');
    const portal = menu.closest('[data-dropdown-portal]');
    expect(portal).not.toBeNull();
    expect(portal?.parentElement).toBe(document.body);
  });

  it('applies the positioning bound to the popover surface itself', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const menu = screen.getByRole('menu');
    expect(menu.style.maxHeight).not.toBe('');
    expect(menu.className).toContain('overflow-y-auto');
  });

  it('closes on an outside mousedown but not on a popup click', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Item' }));
    expect(screen.getByRole('menu')).toBeDefined();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('renders a closing backdrop only when asked', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(document.querySelector('.z-popover-backdrop')).toBeNull();
    cleanup();
    render(<Harness hasBackdrop />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const backdrop = document.querySelector('.z-popover-backdrop');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
