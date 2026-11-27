// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WeekGrid } from '.';
import type { WeekGridDay } from './types';

const DAYS: ReadonlyArray<WeekGridDay> = [
  {
    key: 'mon',
    label: 'Mon',
    isToday: false,
    blocks: [
      {
        key: 'planning',
        title: 'Harborline planning',
        startMinute: 540,
        endMinute: 630,
        color: 'var(--color-identity-2)',
        ariaLabel: '09:00 Harborline planning',
      },
    ],
  },
  {
    key: 'tue',
    label: 'Tue',
    isToday: true,
    blocks: [
      {
        key: 'busy',
        title: 'Busy',
        startMinute: 960,
        endMinute: 1020,
        color: 'var(--color-identity-5)',
        isQuiet: true,
        ariaLabel: '16:00 Busy',
      },
    ],
  },
];

describe('WeekGrid', () => {
  afterEach(cleanup);

  it('names the week and each day, and draws a block per event', () => {
    render(<WeekGrid days={DAYS} fromMinute={480} toMinute={1080} ariaLabel="Week" />);

    const week = screen.getByRole('group', { name: 'Week' });
    const monday = within(week).getByRole('region', { name: 'Mon' });
    expect(within(monday).getByRole('heading', { name: 'Mon' })).toBeTruthy();
    expect(within(monday).getByText('Harborline planning')).toBeTruthy();
    expect(within(week).getByRole('region', { name: 'Tue' }).hasAttribute('data-today')).toBe(true);
  });

  it('opens a block from the keyboard and marks the selected one', () => {
    const onSelect = vi.fn();
    render(
      <WeekGrid
        days={DAYS}
        fromMinute={480}
        toMinute={1080}
        ariaLabel="Week"
        selectedKey="busy"
        onSelect={onSelect}
      />,
    );

    const block = screen.getByRole('button', { name: '09:00 Harborline planning' });
    block.focus();
    expect(document.activeElement).toBe(block);
    fireEvent.click(block);
    expect(onSelect).toHaveBeenCalledWith('planning');
    expect(screen.getByRole('button', { name: '16:00 Busy' }).getAttribute('aria-current')).toBe(
      'true',
    );
  });

  it('draws plain blocks with no button when nothing opens them', () => {
    render(<WeekGrid days={DAYS} fromMinute={480} toMinute={1080} ariaLabel="Week" />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
