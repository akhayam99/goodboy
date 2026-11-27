// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../../store/storyHarness';
import { MOCK_SCENES } from '../../..';
import { CALENDAR_CONNECT_SCENES } from './CalendarConnectScene';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15',
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('the calendar connect scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(CALENDAR_CONNECT_SCENES).sort()).toEqual([
      'calendar-connect-denied',
      'calendar-connect-done',
      'calendar-connect-link',
      'calendar-connect-pick',
    ]);
    expect(MOCK_SCENES['calendar-connect-done']).toBe(
      CALENDAR_CONNECT_SCENES['calendar-connect-done'],
    );
  });

  it('calendar-connect-pick shows both sources and a role per calendar', async () => {
    const Scene = CALENDAR_CONNECT_SCENES['calendar-connect-pick'];
    render(<Scene />);

    const source = await screen.findByRole('tablist', { name: 'Source' }, WAIT);
    expect(within(source).getAllByRole('tab')).toHaveLength(2);
    await screen.findByRole('tablist', { name: 'Personal shows' }, WAIT);
    expect(screen.getByRole('button', { name: 'Connect calendars' })).toBeDefined();
  });

  it('calendar-connect-denied shows the way to System Settings', async () => {
    const Scene = CALENDAR_CONNECT_SCENES['calendar-connect-denied'];
    render(<Scene />);

    await screen.findByText('macOS kept calendar access off.', undefined, WAIT);
    expect(screen.getByRole('button', { name: 'Open System Settings' })).toBeDefined();
  });

  it('calendar-connect-done shows the connected Mac with the stored roles', async () => {
    const Scene = CALENDAR_CONNECT_SCENES['calendar-connect-done'];
    render(<Scene />);

    await screen.findByRole('button', { name: 'Disconnect calendars' }, WAIT);
    const personal = await screen.findByRole('tablist', { name: 'Personal shows' }, WAIT);
    expect(
      within(personal).getByRole('tab', { name: 'Busy only' }).getAttribute('aria-selected'),
    ).toBe('true');
    const focus = screen.getByRole('tablist', { name: 'Focus shows' });
    expect(
      within(focus)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Show', 'Busy only', 'Focus', 'Hide']);
  });
});
