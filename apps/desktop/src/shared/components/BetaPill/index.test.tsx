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

describe('BetaPill', () => {
  it('still reads Beta on the trigger', () => {
    render(<BetaPill />);

    expect(screen.getByRole('button', { name: 'Beta' })).toBeTruthy();
  });

  it('opens the support popover on click', () => {
    render(<BetaPill />);

    expect(screen.queryByRole('dialog', { name: 'Support Goodboy' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));

    expect(screen.getByRole('dialog', { name: 'Support Goodboy' })).toBeTruthy();
  });

  it('opens the exact sponsor URL and nothing else when the action is clicked', () => {
    render(<BetaPill />);

    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sponsor on GitHub' }));

    expect(openUrlMock).toHaveBeenCalledTimes(1);
    expect(openUrlMock).toHaveBeenCalledWith('https://github.com/sponsors/akhayam99');
  });

  it('closes on escape', () => {
    render(<BetaPill />);

    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
    expect(screen.getByRole('dialog', { name: 'Support Goodboy' })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Support Goodboy' })).toBeNull();
  });
});
