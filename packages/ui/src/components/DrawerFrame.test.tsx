// @vitest-environment happy-dom

import { Plus } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
});
