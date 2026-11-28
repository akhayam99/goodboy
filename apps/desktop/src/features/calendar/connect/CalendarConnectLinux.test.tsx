// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CalendarConnectForm } from './CalendarConnectForm';
import { calendarCommands } from './calendarCommands';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('connecting a calendar where the Mac calendars do not exist', () => {
  it('offers only the calendar link and never asks the system for access', () => {
    const accessState = vi.spyOn(calendarCommands, 'accessState');

    render(<CalendarConnectForm isMacOffered={false} />);

    expect(screen.getAllByText('Calendar link').length).toBeGreaterThan(0);
    expect(screen.queryByText('Calendars on this Mac')).toBeNull();
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
    expect(accessState).not.toHaveBeenCalled();
  });
});
