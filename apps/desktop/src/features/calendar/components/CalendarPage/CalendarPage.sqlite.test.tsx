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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { insertWorkspace, listCalendarSources } from '@goodboy/db';
import {
  brandId,
  type CalendarEvent,
  type CalendarSource,
  type CalendarSourceId,
  type WorkspaceId,
} from '@goodboy/types';
import { nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import { CalendarPage } from './index';

const MAC: CalendarSource = {
  id: brandId<CalendarSourceId>({ value: 'src-this-mac' }),
  kind: 'eventkit',
  label: 'This Mac',
  host: null,
  createdAt: 10,
};

const todayAt = ({ hour }: { readonly hour: number }): number => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour).getTime();
};

const REVIEW: CalendarEvent = {
  id: 'src-this-mac:review:1',
  sourceId: MAC.id,
  calendarId: 'harborline',
  uid: 'review@harborline',
  title: 'payments-api review',
  start: todayAt({ hour: 0 }) + 60_000,
  end: todayAt({ hour: 0 }) + 3_600_000,
  isAllDay: false,
  location: null,
  callLink: null,
  isCallLinkTrusted: false,
  attendees: [],
  status: 'confirmed',
  isBusyOnly: false,
};

let useAppStore: StoryStore;
let workspaceId: WorkspaceId;

const relaunch = (): void => {
  cleanup();
  useAppStore.setState({
    calendarSources: [],
    calendarRoles: [],
    calendarDay: null,
    calendarSourcesError: null,
    calendarEventsError: null,
    calendarReminders: {},
  });
};

const showPage = () => render(<CalendarPage workspaceId={workspaceId} />);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  workspaceId = nextWorkspaceId();
  await insertWorkspace({ db, workspace: buildStoryWorkspace({ id: workspaceId }) });
  await useAppStore.getState().addCalendarSource({ source: MAC });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the calendar page after a relaunch', () => {
  it('reads the stored connection and shows the meetings again', async () => {
    stubStoryInvoke({ calendar_list_events: () => ({ items: [REVIEW], failedSources: [] }) });
    relaunch();

    expect(await listCalendarSources({ db: storySqlite() })).toEqual([MAC]);
    showPage();

    expect(await screen.findByText('payments-api review')).toBeTruthy();
    expect(screen.queryByText('Connect a calendar')).toBeNull();
    expect(useAppStore.getState().calendarSources).toEqual([MAC]);
  });

  it('says plainly that macOS closed access, and reads again after Reconnect', async () => {
    let isGranted = false;
    stubStoryInvoke({
      calendar_list_events: () =>
        isGranted
          ? { items: [REVIEW], failedSources: [] }
          : {
              items: [],
              failedSources: [
                { sourceId: MAC.id, kind: 'no_access', message: 'Goodboy has no access' },
              ],
            },
      calendar_request_access: () => {
        isGranted = true;
        return 'granted';
      },
    });
    relaunch();
    showPage();

    expect(await screen.findByText("Goodboy can't read This Mac")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));

    expect(await screen.findByText('payments-api review')).toBeTruthy();
    expect(screen.queryByText("Goodboy can't read This Mac")).toBeNull();
  });

  it('points to System Settings when macOS still refuses', async () => {
    stubStoryInvoke({
      calendar_list_events: () => ({
        items: [],
        failedSources: [{ sourceId: MAC.id, kind: 'no_access', message: 'no access' }],
      }),
      calendar_request_access: () => 'denied',
    });
    relaunch();
    showPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Reconnect' }));

    expect(await screen.findByText('macOS kept calendar access off.')).toBeTruthy();
  });

  it('shows a failed read with Retry, never a grid that looks fine', async () => {
    let calls = 0;
    stubStoryInvoke({
      calendar_list_events: () => {
        calls += 1;
        if (calls === 1) {
          throw new Error('the calendar service stopped');
        }
        return { items: [REVIEW], failedSources: [] };
      },
    });
    relaunch();
    showPage();

    expect(await screen.findByText("Goodboy can't read your meetings")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('payments-api review')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Goodboy can't read your meetings")).toBeNull());
  });

  it('shows a failed read of the stored connection, not Connect a calendar', async () => {
    const db = storySqlite();
    const original = db.select.bind(db);
    const select = vi.spyOn(db, 'select').mockImplementation(async (sql, params) => {
      if (sql.includes('calendar_sources')) {
        throw new Error('database is locked');
      }
      return original(sql, params);
    });
    relaunch();
    showPage();

    expect(await screen.findByText("Goodboy can't read your calendar connections")).toBeTruthy();
    expect(screen.queryByText('Connect a calendar')).toBeNull();

    select.mockRestore();
    stubStoryInvoke({ calendar_list_events: () => ({ items: [REVIEW], failedSources: [] }) });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('payments-api review')).toBeTruthy();
  });
});

describe('reminders on the calendar page', () => {
  it('reads the day and the time in the text and keeps only the words of the reminder', async () => {
    stubStoryInvoke({ calendar_list_events: () => ({ items: [], failedSources: [] }) });
    relaunch();
    showPage();

    const input = await screen.findByLabelText('Add a reminder');
    fireEvent.change(input, { target: { value: 'ask for a beer at 11pm today' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const row = await screen.findByText('ask for a beer');
    expect(row).toBeTruthy();
    screen.getByText(/^Today \d/);
    const [reminder] = useAppStore.getState().calendarReminders[workspaceId] ?? [];
    expect(reminder?.dueAt).toBe(new Date(new Date().setHours(23, 0, 0, 0)).getTime());
  });

  it('keeps a ticked reminder done after a relaunch', async () => {
    stubStoryInvoke({ calendar_list_events: () => ({ items: [], failedSources: [] }) });
    const added = await useAppStore.getState().addReminder({
      workspaceId,
      text: 'Send the Northwind notes',
      trigger: 'time',
      dueAt: Date.now() + 3_600_000,
      target: null,
    });
    if (!added.isOk) {
      throw new Error('reminder not added');
    }
    await useAppStore.getState().markReminderDone({ workspaceId, reminderId: added.value.id });
    relaunch();
    showPage();

    const box = await screen.findByRole('checkbox', {
      name: 'Mark done: Send the Northwind notes',
    });
    expect(box).toHaveProperty('checked', true);
  });
});
