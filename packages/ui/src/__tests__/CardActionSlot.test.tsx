// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CardActionSlot } from '../components/CardActionSlot';

afterEach(cleanup);

describe('CardActionSlot', () => {
  it('lets Escape reach a global listener while still swallowing the row keys', () => {
    const onWindowKeyDown = vi.fn();
    const onRowKeyDown = vi.fn();
    window.addEventListener('keydown', onWindowKeyDown);
    render(
      <div onKeyDown={onRowKeyDown}>
        <CardActionSlot label="Row actions">
          <button type="button">More</button>
        </CardActionSlot>
      </div>,
    );
    const trigger = screen.getByRole('button', { name: 'More' });

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(onWindowKeyDown).toHaveBeenCalledTimes(1);
    expect(onRowKeyDown).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(onWindowKeyDown).toHaveBeenCalledTimes(1);
    expect(onRowKeyDown).toHaveBeenCalledTimes(1);

    window.removeEventListener('keydown', onWindowKeyDown);
  });
});
