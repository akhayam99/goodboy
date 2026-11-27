// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { addCalendarSource, listCalendarRoles, listCalendarSources } from '@goodboy/db';
import {
  brandId,
  type CalendarInfo,
  type CalendarSource,
  type CalendarSourceId,
  type CalendarSourceRef,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySpies,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { CalendarDetail } from './index';

const LINK_ID = 'a3f09c2e5b7d41e8a6c0f2b4d8e1c3a5';
const LINK_SOURCE: CalendarSource = {
  id: brandId<CalendarSourceId>({ value: LINK_ID }),
  kind: 'ics',
  label: 'Northwind team',
  host: 'calendar.northwind.example',
  createdAt: 10,
};

type CalendarParams = {
  readonly sourceId: CalendarSourceId;
  readonly id: string;
  readonly title: string;
};

const calendarOf = ({ sourceId, id, title }: CalendarParams): CalendarInfo => ({
  id,
  sourceId,
  title,
  account: 'harborline.dev',
});

type ListArgs = {
  readonly sources: ReadonlyArray<CalendarSourceRef>;
};

const listTwoCalendars = ({ sources }: ListArgs) => ({
  items: sources.flatMap((source) => [
    calendarOf({ sourceId: source.id, id: 'work', title: 'Work' }),
    calendarOf({ sourceId: source.id, id: 'personal', title: 'Personal' }),
  ]),
  failedSources: [],
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const onMac = () => {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15',
  );
};

const onLinux = () => {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  );
};

const renderDetail = () => render(<CalendarDetail onUp={() => undefined} />);

const invokedWith = (command: string) =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === command).map(([, args]) => args);

const storedSources = () => listCalendarSources({ db: storySqlite() });

const connectButton = () => screen.getByRole('button', { name: 'Connect calendars' });

const pickLink = () => {
  fireEvent.click(screen.getByRole('tab', { name: /Calendar link/ }));
};

const typeLink = (value: string) => {
  fireEvent.change(screen.getByLabelText('Calendar link'), { target: { value } });
};

describe('connecting a calendar', () => {
  it('keeps the form with the System Settings notice when macOS denies access', async () => {
    onMac();
    stubStoryInvoke({
      calendar_access_state: 'not-determined',
      calendar_request_access: 'denied',
      open_privacy_settings: null,
    });
    renderDetail();

    await screen.findByText('Your calendars show here once macOS allows access.');
    fireEvent.click(connectButton());

    await screen.findByText('macOS kept calendar access off.');
    expect(screen.getByRole('form', { name: 'Connect a calendar' })).toBeDefined();
    expect(await storedSources()).toEqual([]);
    expect(useAppStore.getState().calendarSources).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Open System Settings' }));
    await waitFor(() =>
      expect(invokedWith('open_privacy_settings')).toEqual([{ pane: 'calendars' }]),
    );
  });

  it('never asks macOS for access before the click', async () => {
    onMac();
    stubStoryInvoke({ calendar_access_state: 'not-determined' });
    renderDetail();

    await screen.findByText('Your calendars show here once macOS allows access.');
    expect(invokedWith('calendar_request_access')).toEqual([]);
  });

  it('refuses a link that is not https and keeps nothing', async () => {
    onMac();
    stubStoryInvoke({
      calendar_access_state: 'granted',
      calendar_list_calendars: listTwoCalendars,
    });
    renderDetail();

    pickLink();
    typeLink('http://calendar.northwind.example/ical/basic.ics');
    fireEvent.click(connectButton());

    await screen.findByText('Only https links are kept. Use the https address of the calendar.');
    expect(screen.getByLabelText('Calendar link').getAttribute('aria-invalid')).toBe('true');
    expect(invokedWith('calendar_ics_add')).toEqual([]);
    expect(await storedSources()).toEqual([]);
  });

  it('offers only the calendar link away from macOS', async () => {
    onLinux();
    stubStoryInvoke({});
    renderDetail();

    const source = await screen.findByRole('tablist', { name: 'Source' });
    expect(
      within(source)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual([expect.stringContaining('Calendar link')]);
    expect(invokedWith('calendar_access_state')).toEqual([]);
  });

  it('connects a link and saves the role of each calendar', async () => {
    onLinux();
    stubStoryInvoke({
      calendar_ics_add: {
        id: LINK_ID,
        label: 'Northwind team',
        host: 'calendar.northwind.example',
      },
      calendar_list_calendars: listTwoCalendars,
    });
    renderDetail();

    typeLink('https://calendar.northwind.example/ical/basic.ics');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Northwind team' } });
    fireEvent.click(connectButton());

    const personal = await screen.findByRole('tablist', { name: 'Personal shows' });
    expect(invokedWith('calendar_ics_add')).toEqual([
      { label: 'Northwind team', url: 'https://calendar.northwind.example/ical/basic.ics' },
    ]);
    expect(await storedSources()).toEqual([expect.objectContaining({ id: LINK_ID, kind: 'ics' })]);

    fireEvent.click(within(personal).getByRole('tab', { name: 'Busy only' }));

    await waitFor(async () =>
      expect(await listCalendarRoles({ db: storySqlite() })).toEqual([
        { sourceId: LINK_ID, calendarId: 'personal', role: 'busy' },
      ]),
    );
    const work = screen.getByRole('tablist', { name: 'Work shows' });
    expect(within(work).getByRole('tab', { name: 'Show' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('saves the roles picked before macOS access was granted', async () => {
    onMac();
    stubStoryInvoke({
      calendar_access_state: 'granted',
      calendar_request_access: 'granted',
      calendar_list_calendars: listTwoCalendars,
    });
    renderDetail();

    const personal = await screen.findByRole('tablist', { name: 'Personal shows' });
    fireEvent.click(within(personal).getByRole('tab', { name: 'Busy only' }));
    fireEvent.click(connectButton());

    await screen.findByRole('button', { name: 'Disconnect calendars' });
    const [stored] = await storedSources();
    expect(stored?.kind).toBe('eventkit');
    expect(await listCalendarRoles({ db: storySqlite() })).toEqual([
      { sourceId: stored?.id, calendarId: 'personal', role: 'busy' },
    ]);
  });

  it('takes the link off the Keychain when the calendar row is not saved', async () => {
    onLinux();
    stubStoryInvoke({
      calendar_ics_add: {
        id: LINK_ID,
        label: 'Northwind team',
        host: 'calendar.northwind.example',
      },
      calendar_ics_remove: null,
    });
    const db = storySqlite();
    const original = db.execute.bind(db);
    vi.spyOn(db, 'execute').mockImplementation(async (sql, params) => {
      if (sql.includes('INSERT INTO calendar_sources')) {
        throw new Error('disk unavailable');
      }
      return original(sql, params);
    });
    renderDetail();

    typeLink('https://calendar.northwind.example/ical/basic.ics');
    fireEvent.click(connectButton());

    await screen.findByText('The calendar was not saved, and its link was taken off the Keychain.');
    expect(invokedWith('calendar_ics_remove')).toEqual([{ id: LINK_ID }]);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });
});

describe('disconnecting a calendar', () => {
  const seedLink = async () => {
    await addCalendarSource({ db: storySqlite(), source: LINK_SOURCE });
  };

  const confirmDisconnect = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect calendars' }));
    await screen.findByText('Disconnect Northwind team?');
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect calendars' }));
  };

  it('removes the Keychain entry, the source and its roles', async () => {
    onLinux();
    await seedLink();
    stubStoryInvoke({ calendar_list_calendars: listTwoCalendars, calendar_ics_remove: null });
    renderDetail();

    await confirmDisconnect();

    await waitFor(() => expect(invokedWith('calendar_ics_remove')).toEqual([{ id: LINK_ID }]));
    await waitFor(async () => expect(await storedSources()).toEqual([]));
    await screen.findByRole('form', { name: 'Connect a calendar' });
  });

  it('keeps the calendar and shows why when the Keychain refuses', async () => {
    onLinux();
    await seedLink();
    stubStoryInvoke({
      calendar_list_calendars: listTwoCalendars,
      calendar_ics_remove: () => {
        throw { kind: 'keychain', message: 'The Keychain is locked.' };
      },
    });
    renderDetail();

    await confirmDisconnect();

    await screen.findByText('The Keychain is locked.');
    expect(await storedSources()).toEqual([expect.objectContaining({ id: LINK_ID })]);
    expect(useAppStore.getState().calendarSources).toEqual([
      expect.objectContaining({ id: LINK_ID }),
    ]);
  });
});
