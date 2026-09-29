// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AnchoredPopover } from '../components/AnchoredPopover';
import { useDropdown } from '../useDropdown';
import { useEscapeLayer } from '../useEscapeLayer';

afterEach(cleanup);

type PopoverProps = {
  readonly isEscapeEnabled?: boolean;
};

const Popover = ({ isEscapeEnabled }: PopoverProps) => {
  const dropdown = useDropdown({ width: 'w-52', isEscapeEnabled });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="Filter menu"
      trigger={
        <button type="button" onClick={dropdown.toggle} aria-expanded={dropdown.open}>
          Filters
        </button>
      }
    >
      <button type="button" role="menuitem">
        Item
      </button>
    </AnchoredPopover>
  );
};

const Sheet = ({ onClose }: { readonly onClose: () => void }) => {
  useEscapeLayer(onClose);
  return (
    <section aria-label="Sheet">
      <Popover />
    </section>
  );
};

const Page = () => {
  const [isPageOpen, setPageOpen] = useState(true);
  const [isSheetOpen, setSheetOpen] = useState(false);
  useEscapeLayer(() => setPageOpen(false), isPageOpen);
  return (
    <div>
      <button type="button" onClick={() => setSheetOpen(true)}>
        Open sheet
      </button>
      {isPageOpen ? <span>page</span> : null}
      {isSheetOpen ? <Sheet onClose={() => setSheetOpen(false)} /> : null}
    </div>
  );
};

const press = (init: KeyboardEventInit = {}): void => {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', cancelable: true, ...init }),
    );
  });
};

const openSheet = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Open sheet' }));
};

const openPopover = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
};

describe('useDropdown on the escape stack', () => {
  it('closes only the popover, then the sheet, then the page', () => {
    render(<Page />);
    openSheet();
    openPopover();
    expect(screen.getByRole('menu')).toBeDefined();

    press();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Sheet' })).not.toBeNull();
    expect(screen.queryByText('page')).not.toBeNull();

    press();
    expect(screen.queryByRole('region', { name: 'Sheet' })).toBeNull();
    expect(screen.queryByText('page')).not.toBeNull();

    press();
    expect(screen.queryByText('page')).toBeNull();
  });

  it('leaves the stack when it closes by another route, so the sheet gets the next escape', () => {
    render(<Page />);
    openSheet();
    openPopover();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.queryByRole('menu')).toBeNull();

    press();
    expect(screen.queryByRole('region', { name: 'Sheet' })).toBeNull();
  });

  it('gives focus back to the trigger when escape closes it from inside', () => {
    render(<Popover />);
    openPopover();
    screen.getByRole('menuitem').focus();

    press();

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Filters' }));
  });

  it('leaves focus alone when it already moved to another control', () => {
    render(
      <div>
        <Popover />
        <input aria-label="Elsewhere" />
      </div>,
    );
    openPopover();
    const elsewhere = screen.getByLabelText('Elsewhere');
    elsewhere.focus();

    press();

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(elsewhere);
  });

  it('does not join the stack when escape is disabled, so the layer below gets the key', () => {
    let closedBelow = 0;
    const Below = () => {
      useEscapeLayer(() => {
        closedBelow += 1;
      });
      return <Popover isEscapeEnabled={false} />;
    };
    render(<Below />);
    openPopover();

    press();

    expect(closedBelow).toBe(1);
    expect(screen.queryByRole('menu')).not.toBeNull();
  });

  it('ignores an escape that a focused editor already claimed', () => {
    render(<Popover />);
    openPopover();

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        cancelable: true,
      });
      event.preventDefault();
      window.dispatchEvent(event);
    });

    expect(screen.queryByRole('menu')).not.toBeNull();
  });
});
