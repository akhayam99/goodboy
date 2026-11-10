// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DrawerColumn } from '../components/DrawerColumn';
import { DrawerFrame } from '../components/DrawerFrame';

afterEach(cleanup);

type OverlayParams = {
  readonly isParked: boolean;
};

const overlayColumn = ({ isParked }: OverlayParams) => (
  <DrawerColumn
    main={<button type="button">Tasks</button>}
    drawer={<button type="button">Refresh ledger-core</button>}
    placement="overlay"
    isParked={isParked}
    ariaLabel="Side panel"
    resizeLabel="Resize side panel"
  />
);

describe('DrawerColumn parked under a page', () => {
  it('puts focus back in an overlay drawer when the page closes', () => {
    const view = render(overlayColumn({ isParked: false }));
    const inside = screen.getByRole('button', { name: 'Refresh ledger-core' });
    expect(document.activeElement).toBe(inside);

    view.rerender(overlayColumn({ isParked: true }));
    inside.blur();
    expect(document.activeElement).toBe(document.body);

    view.rerender(overlayColumn({ isParked: false }));

    expect(document.activeElement).toBe(inside);
  });

  it('leaves Escape to a frame drawn in the page while the drawer is parked', () => {
    const onPageClose = vi.fn();
    const onDrawerClose = vi.fn();
    render(
      <DrawerColumn
        main={
          <DrawerFrame title="Guide" onClose={onPageClose}>
            <p>Harborline</p>
          </DrawerFrame>
        }
        drawer={
          <DrawerFrame title="Context" onClose={onDrawerClose}>
            <p>ledger-core</p>
          </DrawerFrame>
        }
        isParked
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(onPageClose).toHaveBeenCalledTimes(1);
    expect(onDrawerClose).not.toHaveBeenCalled();
  });
});
