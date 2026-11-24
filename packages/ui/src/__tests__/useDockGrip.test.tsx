// @vitest-environment happy-dom

import { createPortal } from 'react-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DockDragContext } from '../dockDragContext';
import { useDockGrip } from '../useDockGrip';

type RowProps = {
  readonly hasPortal?: boolean;
};

const Row = ({ hasPortal = false }: RowProps) => {
  const grip = useDockGrip();
  return (
    <div
      data-testid="row"
      data-can-drag={grip.canDrag}
      onPointerDown={(event) => grip.press({ event })}
    >
      <span data-testid="gap">gap</span>
      <button type="button">Back</button>
      {hasPortal
        ? createPortal(
            <div role="option" aria-selected={false}>
              Checkout
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

afterEach(cleanup);

describe('useDockGrip', () => {
  it('is off outside a dock cell', () => {
    render(<Row />);

    expect(screen.getByTestId('row').getAttribute('data-can-drag')).toBe('false');
  });

  it('starts a drag from the row but never from a control or a layer it portals out', () => {
    const onStart = vi.fn();
    render(
      <DockDragContext.Provider value={{ onStart }}>
        <Row hasPortal />
      </DockDragContext.Provider>,
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Back' }));
    fireEvent.pointerDown(screen.getByRole('option', { name: 'Checkout' }));
    expect(onStart).not.toHaveBeenCalled();

    fireEvent.pointerDown(screen.getByTestId('gap'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
