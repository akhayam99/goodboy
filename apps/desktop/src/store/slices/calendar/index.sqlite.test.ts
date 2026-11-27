vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace } from '@goodboy/db';
import {
  brandId,
  type CalendarEvent,
  type CalendarEventsRequest,
  type CalendarList,
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
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../storyHarness';

const LINK: CalendarSource = {
  id: brandId<CalendarSourceId>({ value: 'src-northwind' }),
  kind: 'ics',
  label: 'Northwind team',
  host: 'calendar.northwind.example',
  createdAt: 10,
};

const STANDUP: CalendarEvent = {
  id: 'src-northwind:standup:1000',
  sourceId: LINK.id,
  calendarId: 'team',
  uid: 'standup@northwind',
  title: 'ledger-core standup',
  start: 1000,
  end: 2000,
  isAllDay: false,
  location: 'Room Cascadia',
  callLink: 'https://meet.google.com/abc-defg-hij',
  isCallLinkTrusted: true,
  attendees: ['Teo', 'Mara'],
  status: 'confirmed',
  isBusyOnly: false,
};

const REVIEW: CalendarEvent = {
  ...STANDUP,
  id: 'src-northwind:review:3000',
  uid: 'review@northwind',
  title: 'payments-api review',
  start: 3000,
  end: 4000,
};

const TODAY = { from: 0, to: 10_000 };
const TOMORROW = { from: 10_000, to: 20_000 };

let useAppStore: StoryStore;
let workspaceId: WorkspaceId;

type ListParams = {
  readonly items: ReadonlyArray<CalendarEvent>;
};

const listed = ({ items }: ListParams): CalendarList<CalendarEvent> => ({
  items,
  failedSources: [],
});

type FailParams = {
  readonly table: string;
};

const failNextWrite = ({ table }: FailParams) => {
  const db = storySqlite();
  const original = db.execute.bind(db);
  const execute = vi.spyOn(db, 'execute');
  execute.mockImplementation(async (sql, params) => {
    if (sql.includes(table)) {
      throw new Error('disk unavailable');
    }
    return original(sql, params);
  });
  return execute;
};

const reminderTexts = () =>
  (useAppStore.getState().calendarReminders[workspaceId] ?? []).map((reminder) => ({
    text: reminder.text,
    isDone: reminder.doneAt !== null,
  }));

const storedErrors = () =>
  useAppStore
    .getState()
    .notifications.filter((notification) => notification.kind === 'error')
    .map((notification) => notification.title);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  workspaceId = nextWorkspaceId();
  await insertWorkspace({ db, workspace: buildStoryWorkspace({ id: workspaceId }) });
});

describe('the calendar slice', () => {
  it('connects a source and starts every calendar on show', async () => {
    const result = await useAppStore.getState().addCalendarSource({ source: LINK });
    await useAppStore.getState().loadCalendarSources();

    expect(result.isOk).toBe(true);
    expect(useAppStore.getState().calendarSources).toEqual([LINK]);
    expect(useAppStore.getState().calendarRoles).toEqual([]);

    await useAppStore.getState().loadCalendarEvents({
      range: TODAY,
      listEvents: async () => listed({ items: [STANDUP] }),
    });

    expect(useAppStore.getState().calendarDay?.events).toEqual([STANDUP]);
  });

  it('keeps the old role and shows the error when the role write fails', async () => {
    await useAppStore.getState().addCalendarSource({ source: LINK });
    await useAppStore.getState().setCalendarRole({
      entry: { sourceId: LINK.id, calendarId: 'team', role: 'busy' },
    });
    const execute = failNextWrite({ table: 'calendar_roles' });

    const result = await useAppStore.getState().setCalendarRole({
      entry: { sourceId: LINK.id, calendarId: 'team', role: 'hide' },
    });
    execute.mockRestore();

    expect(result.isOk).toBe(false);
    expect(useAppStore.getState().calendarRoles).toEqual([
      { sourceId: LINK.id, calendarId: 'team', role: 'busy' },
    ]);
    await vi.waitFor(() => {
      expect(storedErrors()).toEqual(["Couldn't change how the calendar shows"]);
    });
  });

  it('keeps no source in memory when connecting fails', async () => {
    const execute = failNextWrite({ table: 'calendar_sources' });

    const result = await useAppStore.getState().addCalendarSource({ source: LINK });
    execute.mockRestore();

    expect(result.isOk).toBe(false);
    expect(useAppStore.getState().calendarSources).toEqual([]);
  });

  it('shows a busy calendar without its title, people, place or call link', async () => {
    await useAppStore.getState().addCalendarSource({ source: LINK });
    await useAppStore.getState().setCalendarRole({
      entry: { sourceId: LINK.id, calendarId: 'team', role: 'busy' },
    });

    await useAppStore.getState().loadCalendarEvents({
      range: TODAY,
      listEvents: async () => listed({ items: [STANDUP] }),
    });

    const [shown] = useAppStore.getState().calendarDay?.events ?? [];
    expect(shown).toMatchObject({
      title: '',
      location: null,
      callLink: null,
      attendees: [],
      isBusyOnly: true,
    });
  });

  it('sends the stored sources and drops a late answer for an older range', async () => {
    await useAppStore.getState().addCalendarSource({ source: LINK });
    const requests: CalendarEventsRequest[] = [];
    let releaseToday: (list: CalendarList<CalendarEvent>) => void = () => undefined;
    const listEvents = (request: CalendarEventsRequest) => {
      requests.push(request);
      if (request.from === TODAY.from) {
        return new Promise<CalendarList<CalendarEvent>>((resolve) => {
          releaseToday = resolve;
        });
      }
      return Promise.resolve(listed({ items: [REVIEW] }));
    };

    const today = useAppStore.getState().loadCalendarEvents({ range: TODAY, listEvents });
    await useAppStore.getState().loadCalendarEvents({ range: TOMORROW, listEvents });
    releaseToday(listed({ items: [STANDUP] }));
    await today;

    expect(useAppStore.getState().calendarDay).toEqual({
      range: TOMORROW,
      events: [REVIEW],
      failedSources: [],
    });
    expect(requests[0]?.sources).toEqual([{ id: LINK.id, kind: 'ics' }]);
  });

  it('keeps the day it had and reports once when the newest load fails', async () => {
    await useAppStore.getState().addCalendarSource({ source: LINK });
    await useAppStore.getState().loadCalendarEvents({
      range: TODAY,
      listEvents: async () => listed({ items: [STANDUP] }),
    });

    await useAppStore.getState().loadCalendarEvents({
      range: TOMORROW,
      listEvents: async () => {
        throw new Error('fetch failed');
      },
    });

    expect(useAppStore.getState().calendarDay?.range).toEqual(TODAY);
    await vi.waitFor(() => {
      expect(storedErrors()).toEqual(["Couldn't load your meetings"]);
    });
  });

  it('drops the events and roles of a source it disconnects', async () => {
    await useAppStore.getState().addCalendarSource({ source: LINK });
    await useAppStore.getState().setCalendarRole({
      entry: { sourceId: LINK.id, calendarId: 'team', role: 'focus' },
    });
    await useAppStore.getState().loadCalendarEvents({
      range: TODAY,
      listEvents: async () => listed({ items: [STANDUP] }),
    });

    await useAppStore.getState().removeCalendarSource({ sourceId: LINK.id });
    await useAppStore.getState().loadCalendarSources();

    expect(useAppStore.getState().calendarSources).toEqual([]);
    expect(useAppStore.getState().calendarRoles).toEqual([]);
    expect(useAppStore.getState().calendarDay?.events).toEqual([]);
  });

  it('adds a reminder to the workspace it names and refuses empty text', async () => {
    const empty = await useAppStore.getState().addReminder({
      workspaceId,
      text: '   ',
      trigger: 'time',
      dueAt: 500,
      target: null,
    });
    await useAppStore.getState().addReminder({
      workspaceId,
      text: ' Ping Teo about notify-relay ',
      trigger: 'time',
      dueAt: 500,
      target: null,
    });
    await useAppStore.getState().loadReminders({ workspaceId, doneSince: 0 });

    expect(empty.isOk).toBe(false);
    expect(reminderTexts()).toEqual([{ text: 'Ping Teo about notify-relay', isDone: false }]);
  });

  it('keeps no reminder when the write fails', async () => {
    const execute = failNextWrite({ table: 'reminders' });

    const result = await useAppStore.getState().addReminder({
      workspaceId,
      text: 'Merge ledger-core',
      trigger: 'time',
      dueAt: 500,
      target: null,
    });
    execute.mockRestore();

    expect(result.isOk).toBe(false);
    expect(reminderTexts()).toEqual([]);
    await vi.waitFor(() => {
      expect(storedErrors()).toEqual(["Couldn't add the reminder"]);
    });
  });

  it('marks a reminder done and undoes it from the toast', async () => {
    const added = await useAppStore.getState().addReminder({
      workspaceId,
      text: 'Ping Teo about notify-relay',
      trigger: 'time',
      dueAt: 500,
      target: null,
    });
    if (!added.isOk) {
      throw new Error('reminder not added');
    }

    await useAppStore.getState().markReminderDone({ workspaceId, reminderId: added.value.id });
    expect(reminderTexts()).toEqual([{ text: 'Ping Teo about notify-relay', isDone: true }]);

    expect(await useAppStore.getState().undoLastOperation()).toBe(true);
    expect(reminderTexts()).toEqual([{ text: 'Ping Teo about notify-relay', isDone: false }]);
    await useAppStore.getState().loadReminders({ workspaceId, doneSince: 0 });
    expect(reminderTexts()).toEqual([{ text: 'Ping Teo about notify-relay', isDone: false }]);
  });

  it('keeps the reminder open when the done write fails', async () => {
    const added = await useAppStore.getState().addReminder({
      workspaceId,
      text: 'Ping Teo about notify-relay',
      trigger: 'time',
      dueAt: 500,
      target: null,
    });
    if (!added.isOk) {
      throw new Error('reminder not added');
    }
    const execute = failNextWrite({ table: 'reminders' });

    const result = await useAppStore.getState().markReminderDone({
      workspaceId,
      reminderId: added.value.id,
    });
    execute.mockRestore();

    expect(result.isOk).toBe(false);
    expect(reminderTexts()).toEqual([{ text: 'Ping Teo about notify-relay', isDone: false }]);
    expect(useAppStore.getState().undoStack).toEqual([]);
  });

  it('does not reopen a reminder that changed after it was done', async () => {
    const added = await useAppStore.getState().addReminder({
      workspaceId,
      text: 'Ping Teo about notify-relay',
      trigger: 'time',
      dueAt: 500,
      target: null,
    });
    if (!added.isOk) {
      throw new Error('reminder not added');
    }
    await useAppStore.getState().markReminderDone({ workspaceId, reminderId: added.value.id });
    await storySqlite().execute('UPDATE reminders SET done_at = done_at + 1 WHERE id = ?', [
      added.value.id,
    ]);

    expect(await useAppStore.getState().undoLastOperation()).toBe(false);
    await useAppStore.getState().loadReminders({ workspaceId, doneSince: 0 });
    expect(reminderTexts()).toEqual([{ text: 'Ping Teo about notify-relay', isDone: true }]);
  });

  it('snoozes an open reminder and refuses one that is gone', async () => {
    const added = await useAppStore.getState().addReminder({
      workspaceId,
      text: 'Ping Teo about notify-relay',
      trigger: 'time',
      dueAt: 500,
      target: null,
    });
    if (!added.isOk) {
      throw new Error('reminder not added');
    }

    await useAppStore
      .getState()
      .snoozeReminder({ workspaceId, reminderId: added.value.id, snoozedUntil: 900 });
    const gone = await useAppStore.getState().snoozeReminder({
      workspaceId,
      reminderId: brandId({ value: 'rem-gone' }),
      snoozedUntil: 900,
    });

    expect(useAppStore.getState().calendarReminders[workspaceId]?.[0]?.snoozedUntil).toBe(900);
    expect(gone.isOk).toBe(false);
  });
});
