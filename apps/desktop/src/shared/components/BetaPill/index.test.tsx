import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { openUrlMock } = vi.hoisted(() => ({
  openUrlMock: vi.fn(async () => undefined),
}));

vi.mock('../../lib/editor', () => ({
  openUrl: openUrlMock,
}));

import { BetaPill } from './index';

afterEach(() => {
  cleanup();
  openUrlMock.mockClear();
});

const TRIGGER_LABEL = 'Beta build, open the sponsor panel';

describe('BetaPill', () => {
  it('reads as a two-part Beta and Sponsor trigger', () => {
    render(<BetaPill />);

    const trigger = screen.getByRole('button', { name: TRIGGER_LABEL });

    expect(trigger.textContent).toBe('BetaSponsor');
  });

  it('opens the support popover on click', () => {
    render(<BetaPill />);

    expect(screen.queryByRole('dialog', { name: 'Support Goodboy' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: TRIGGER_LABEL }));

    expect(screen.getByRole('dialog', { name: 'Support Goodboy' })).toBeTruthy();
  });

  it('opens the exact sponsor URL and nothing else when the action is clicked', () => {
    render(<BetaPill />);

    fireEvent.click(screen.getByRole('button', { name: TRIGGER_LABEL }));
    fireEvent.click(screen.getByRole('button', { name: 'Sponsor on GitHub' }));

    expect(openUrlMock).toHaveBeenCalledTimes(1);
    expect(openUrlMock).toHaveBeenCalledWith('https://github.com/sponsors/akhayam99');
  });

  it('closes on escape', () => {
    render(<BetaPill />);

    fireEvent.click(screen.getByRole('button', { name: TRIGGER_LABEL }));
    expect(screen.getByRole('dialog', { name: 'Support Goodboy' })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Support Goodboy' })).toBeNull();
  });
});
