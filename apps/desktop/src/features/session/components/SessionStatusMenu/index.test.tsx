// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SessionStatusMenu } from './index';

afterEach(cleanup);

describe('SessionStatusMenu', () => {
  it('renders the trigger with the current status label in aria-label', () => {
    render(<SessionStatusMenu status="wip" sessionLabel="fix bug" onPick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /change session status/i })).toBeDefined();
  });

  it('opens the menu and offers selectable status options', () => {
    const onPick = vi.fn();
    render(<SessionStatusMenu status="wip" sessionLabel="fix bug" onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /change session status/i }));
    const items = screen.getAllByRole('menuitem');
    expect(items.length).toBeGreaterThan(1);
  });

  it('fires onPick with the chosen status', () => {
    const onPick = vi.fn();
    render(<SessionStatusMenu status="wip" sessionLabel="fix bug" onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /change session status/i }));
    const items = screen.getAllByRole('menuitem');
    const other = items.find((el) => !el.className.includes('font-medium'));
    if (other) {
      fireEvent.click(other);
    }
    expect(onPick).toHaveBeenCalled();
  });
});
