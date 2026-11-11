// @vitest-environment happy-dom

import { Plus } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DrawerBackChipContext } from '../drawerBackChipContext';
import { DrawerFrame } from './DrawerFrame';
import { IconButton } from './IconButton';

const headButtons = (): ReadonlyArray<string | null> =>
  Array.from(
    document.querySelector('[data-drawer-header-row]')?.querySelectorAll('button') ?? [],
  ).map((button) => button.getAttribute('aria-label'));

describe('DrawerFrame head', () => {
  afterEach(cleanup);

  it('draws Open page between the action and Close, and presses it', () => {
    const onOpen = vi.fn();
    render(
      <DrawerFrame
        title="Terminal"
        action={<IconButton icon={Plus} label="New script" />}
        page={{ tooltip: 'Open on the Terminal page', onOpen }}
        onClose={vi.fn()}
      >
        body
      </DrawerFrame>,
    );

    expect(headButtons()).toEqual(['New script', 'Open page', 'Close']);
    fireEvent.click(screen.getByRole('button', { name: 'Open page' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('draws no page arrow without the page prop', () => {
    render(
      <DrawerFrame title="Explore" onClose={vi.fn()}>
        body
      </DrawerFrame>,
    );

    expect(headButtons()).toEqual(['Close']);
  });

  it('keeps the same head row height for a title with and without a page arrow', () => {
    const { container, rerender } = render(
      <DrawerFrame title="Explore" onClose={vi.fn()}>
        body
      </DrawerFrame>,
    );
    const plain = container.querySelector('[data-drawer-header-row]')?.className;
    rerender(
      <DrawerFrame title="Explore" page={{ onOpen: vi.fn() }} onClose={vi.fn()}>
        body
      </DrawerFrame>,
    );

    expect(container.querySelector('[data-drawer-header-row]')?.className).toBe(plain);
  });

  it('names the page button with its own words when the drawer gives them', () => {
    const onOpen = vi.fn();
    render(
      <DrawerFrame title="Terminal" page={{ label: 'Open as page', onOpen }} onClose={vi.fn()}>
        body
      </DrawerFrame>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open as page' }));

    expect(onOpen).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Open page' })).toBeNull();
  });

  it('leads the head with the back chip and drops the back row while the chip holds one', () => {
    const onBack = vi.fn();
    render(
      <DrawerBackChipContext.Provider
        value={{ kind: 'Plan', title: 'Add tax to the checkout total', onBack }}
      >
        <DrawerFrame
          title="Terminal"
          back={{ label: 'Back to Explore', onBack: vi.fn() }}
          onClose={vi.fn()}
        >
          body
        </DrawerFrame>
      </DrawerBackChipContext.Provider>,
    );

    expect(headButtons()).toEqual(['Back to Plan · Add tax to the checkout total', 'Close']);
    expect(screen.queryByRole('button', { name: 'Back to Explore' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Back to Plan/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
