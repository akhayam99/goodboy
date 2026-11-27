import { useEffect } from 'react';
import {
  brandId,
  type CalendarAccessState,
  type CalendarInfo,
  type CalendarSourceId,
} from '@goodboy/types';
import type { ConnectionsFocus } from '../../../../../../features/connections/connectionsFocus';
import { ConnectionsFrame } from '../../audit/ConnectionsFrame';
import { payloadString } from '../../audit/ipcPayload';
import { mockSceneIpc } from '../../mockSceneIpc';

const CALENDAR_PAGE: ConnectionsFocus = { kind: 'calendar' };
const DRIVE_AFTER_MS = 1_200;
const MAC_SOURCE_ID = brandId<CalendarSourceId>({ value: 'scene-this-mac' });

type CalendarSeed = {
  readonly id: string;
  readonly title: string;
  readonly account: string;
};

const CALENDARS: ReadonlyArray<CalendarSeed> = [
  { id: 'work', title: 'Work', account: 'platform@harborline.dev' },
  { id: 'personal', title: 'Personal', account: 'iCloud' },
  { id: 'focus', title: 'Focus', account: 'platform@harborline.dev' },
  { id: 'holidays', title: 'Holidays', account: 'iCloud' },
];

const SOURCE_ROW = {
  id: MAC_SOURCE_ID,
  kind: 'eventkit',
  label: 'Calendars on this Mac',
  host: null,
  created_at: 0,
};

const ROLE_ROWS = [
  { source_id: MAC_SOURCE_ID, calendar_id: 'personal', role: 'busy' },
  { source_id: MAC_SOURCE_ID, calendar_id: 'holidays', role: 'hide' },
];

type SeedParams = {
  readonly access: CalendarAccessState;
  readonly isConnected: boolean;
};

type ListedParams = {
  readonly sourceId: CalendarSourceId;
};

const PREVIEW_SOURCE_ID = brandId<CalendarSourceId>({ value: 'scene-preview' });

const listedFor = ({ sourceId }: ListedParams) => ({
  items: CALENDARS.map((calendar): CalendarInfo => ({ ...calendar, sourceId })),
  failedSources: [],
});

const seedCalendar =
  ({ access, isConnected }: SeedParams) =>
  (): void => {
    mockSceneIpc((command, payload) => {
      if (command === 'calendar_access_state' || command === 'calendar_request_access') {
        return access;
      }
      if (command === 'calendar_list_calendars') {
        return listedFor({ sourceId: isConnected ? MAC_SOURCE_ID : PREVIEW_SOURCE_ID });
      }
      if (command !== 'db_select' || !isConnected) {
        return undefined;
      }
      const sql = payloadString({ payload, key: 'sql' }) ?? '';
      if (sql.includes('FROM calendar_sources')) {
        return [SOURCE_ROW];
      }
      if (sql.includes('FROM calendar_roles')) {
        return ROLE_ROWS;
      }
      return undefined;
    });
  };

const PICK = seedCalendar({ access: 'granted', isConnected: false });
const DENIED = seedCalendar({ access: 'denied', isConnected: false });
const CONNECTED = seedCalendar({ access: 'granted', isConnected: true });

const PickLink = () => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
      tabs.find((tab) => (tab.textContent ?? '').startsWith('Calendar link'))?.click();
    }, DRIVE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
};

export const CALENDAR_CONNECT_SCENES = {
  'calendar-connect-pick': () => <ConnectionsFrame focus={CALENDAR_PAGE} seed={PICK} />,
  'calendar-connect-denied': () => <ConnectionsFrame focus={CALENDAR_PAGE} seed={DENIED} />,
  'calendar-connect-link': () => (
    <>
      <ConnectionsFrame focus={CALENDAR_PAGE} seed={PICK} />
      <PickLink />
    </>
  ),
  'calendar-connect-done': () => <ConnectionsFrame focus={CALENDAR_PAGE} seed={CONNECTED} />,
};
