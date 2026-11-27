import { brandId, type CalendarSource, type CalendarSourceId } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  addCalendarSource,
  listCalendarRoles,
  listCalendarSources,
  removeCalendarSource,
  setCalendarRole,
} from './calendar-source';

const LINK: CalendarSource = {
  id: brandId<CalendarSourceId>({ value: 'src-link' }),
  kind: 'ics',
  label: 'Northwind team',
  host: 'calendar.northwind.example',
  createdAt: 10,
};

const MAC: CalendarSource = {
  id: brandId<CalendarSourceId>({ value: 'src-mac' }),
  kind: 'eventkit',
  label: 'This Mac',
  host: null,
  createdAt: 20,
};

describe('calendar source queries', () => {
  it('adds sources and lists them oldest first', async () => {
    const db = await makeMigratedTestDatabase();

    await addCalendarSource({ db, source: MAC });
    await addCalendarSource({ db, source: LINK });

    expect(await listCalendarSources({ db })).toEqual([LINK, MAC]);
  });

  it('returns the Mac source already stored when a second window connects it again', async () => {
    const db = await makeMigratedTestDatabase();
    await addCalendarSource({ db, source: MAC });

    const stored = await addCalendarSource({
      db,
      source: { ...MAC, id: brandId<CalendarSourceId>({ value: 'src-mac-2' }), createdAt: 30 },
    });

    expect(stored).toEqual(MAC);
    expect(await listCalendarSources({ db })).toEqual([MAC]);
  });

  it('keeps one role per calendar and moves it on a second pick', async () => {
    const db = await makeMigratedTestDatabase();
    await addCalendarSource({ db, source: LINK });

    expect(
      await setCalendarRole({
        db,
        entry: { sourceId: LINK.id, calendarId: 'cal-1', role: 'busy' },
      }),
    ).toBe(true);
    await setCalendarRole({ db, entry: { sourceId: LINK.id, calendarId: 'cal-1', role: 'hide' } });

    expect(await listCalendarRoles({ db })).toEqual([
      { sourceId: LINK.id, calendarId: 'cal-1', role: 'hide' },
    ]);
  });

  it('writes no role for a source that is gone', async () => {
    const db = await makeMigratedTestDatabase();

    expect(
      await setCalendarRole({
        db,
        entry: { sourceId: LINK.id, calendarId: 'cal-1', role: 'busy' },
      }),
    ).toBe(false);
    expect(await listCalendarRoles({ db })).toEqual([]);
  });

  it('removes a source with its roles and says when nothing was there', async () => {
    const db = await makeMigratedTestDatabase();
    await addCalendarSource({ db, source: LINK });
    await addCalendarSource({ db, source: MAC });
    await setCalendarRole({ db, entry: { sourceId: LINK.id, calendarId: 'cal-1', role: 'busy' } });
    await setCalendarRole({ db, entry: { sourceId: MAC.id, calendarId: 'cal-2', role: 'focus' } });

    expect(await removeCalendarSource({ db, sourceId: LINK.id })).toBe(true);
    expect(await removeCalendarSource({ db, sourceId: LINK.id })).toBe(false);

    expect(await listCalendarSources({ db })).toEqual([MAC]);
    expect(await listCalendarRoles({ db })).toEqual([
      { sourceId: MAC.id, calendarId: 'cal-2', role: 'focus' },
    ]);
  });
});
