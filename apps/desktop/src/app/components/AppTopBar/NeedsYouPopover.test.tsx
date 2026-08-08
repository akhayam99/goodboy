// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../../store', () => ({
  useAppStore: <T,>(
    selector: (s: { setCurrentSession: () => Promise<void>; setActiveLens: () => void }) => T,
  ) => selector({ setCurrentSession: async () => undefined, setActiveLens: () => {} }),
}));

import { NeedsYouPopover } from './NeedsYouPopover';

afterEach(cleanup);

describe('NeedsYouPopover', () => {
  it('opens its popover on the named z-popover layer, above a full-page studio', async () => {
    render(<NeedsYouPopover sessions={[]} count={1} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /needs you/i }));
    });

    expect(document.body.querySelector('.z-popover-backdrop')).not.toBeNull();
    expect(document.body.querySelector('.z-popover')).not.toBeNull();
  });

  it('closes on escape without pulling focus back to the trigger', async () => {
    render(<NeedsYouPopover sessions={[]} count={1} />);
    const trigger = screen.getByRole('button', { name: /needs you/i });

    await act(async () => {
      fireEvent.click(trigger);
    });
    expect(screen.getByRole('dialog', { name: 'Sessions needing attention' })).toBeDefined();

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(screen.queryByRole('dialog', { name: 'Sessions needing attention' })).toBeNull();
    expect(document.activeElement).not.toBe(trigger);
  });

  it('closes when the backdrop is clicked', async () => {
    render(<NeedsYouPopover sessions={[]} count={1} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /needs you/i }));
    });
    const backdrop = document.body.querySelector('.z-popover-backdrop');
    expect(backdrop).not.toBeNull();

    await act(async () => {
      fireEvent.click(backdrop as Element);
    });

    expect(screen.queryByRole('dialog', { name: 'Sessions needing attention' })).toBeNull();
  });

  it('reopens after a second click on the trigger', async () => {
    render(<NeedsYouPopover sessions={[]} count={1} />);
    const trigger = screen.getByRole('button', { name: /needs you/i });

    await act(async () => {
      fireEvent.click(trigger);
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    await act(async () => {
      fireEvent.click(trigger);
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await act(async () => {
      fireEvent.click(trigger);
    });
    expect(screen.getByRole('dialog', { name: 'Sessions needing attention' })).toBeDefined();
  });
});
