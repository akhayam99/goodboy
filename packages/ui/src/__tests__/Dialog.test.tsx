// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Dialog } from '../components/Dialog';
import { escapeLayerCount } from '../escape';

afterEach(cleanup);

const pressEscape = (): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { code: 'Escape', cancelable: true });
  window.dispatchEvent(event);
  return event;
};

describe('Dialog', () => {
  it('focuses the first enabled field in the dialog body', () => {
    render(
      <Dialog open onClose={() => undefined} title="Add workspace">
        <div className="flex flex-col gap-2">
          <input aria-label="Workspace path" />
          <button type="button">Secondary action</button>
        </div>
      </Dialog>,
    );

    expect(screen.getByRole('button', { name: 'close' })).not.toBe(document.activeElement);
    expect(screen.getByLabelText('Workspace path')).toBe(document.activeElement);
  });

  it('closes on escape', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Add workspace">
        <p>body</p>
      </Dialog>,
    );

    expect(pressEscape().defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('leaves escape alone while closed', () => {
    const onClose = vi.fn();
    render(
      <Dialog open={false} onClose={onClose} title="Add workspace">
        <p>body</p>
      </Dialog>,
    );

    expect(escapeLayerCount()).toBe(0);
    expect(pressEscape().defaultPrevented).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes the dialog opened last when two are stacked', () => {
    const closeUnder = vi.fn();
    const closeOver = vi.fn();
    render(
      <>
        <Dialog open onClose={closeUnder} title="Workspace">
          <p>under</p>
        </Dialog>
        <Dialog open onClose={closeOver} title="Confirm">
          <p>over</p>
        </Dialog>
      </>,
    );

    pressEscape();

    expect(closeOver).toHaveBeenCalledOnce();
    expect(closeUnder).not.toHaveBeenCalled();
  });

  it('drops its layer once it closes', () => {
    const { rerender } = render(
      <Dialog open onClose={() => undefined} title="Workspace">
        <p>body</p>
      </Dialog>,
    );
    expect(escapeLayerCount()).toBe(1);

    rerender(
      <Dialog open={false} onClose={() => undefined} title="Workspace">
        <p>body</p>
      </Dialog>,
    );

    expect(escapeLayerCount()).toBe(0);
  });
});
