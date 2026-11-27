import {
  brandId,
  DEFAULT_CALENDAR_ROLE,
  type CalendarAccessState,
  type CalendarRole,
  type CalendarSourceId,
} from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { calendarCommands } from './calendarCommands';
import { CALENDAR_CONNECT_COPY } from './calendarConnectCopy';

type Params = {
  readonly roles: Readonly<Record<string, CalendarRole>>;
  readonly nowMs: number;
};

export type MacConnectOutcome =
  | { readonly kind: 'connected' }
  | { readonly kind: 'refused'; readonly access: CalendarAccessState }
  | { readonly kind: 'failed'; readonly message: string };

const STORE_FAILED = 'The calendar was not saved. Try again.';

export const connectMacCalendars = async ({ roles, nowMs }: Params): Promise<MacConnectOutcome> => {
  let access: CalendarAccessState;
  try {
    access = await calendarCommands.requestAccess();
  } catch (error) {
    return { kind: 'failed', message: formatError(error) };
  }
  if (access !== 'granted') {
    return { kind: 'refused', access };
  }
  const state = useAppStore.getState();
  const added = await state.addCalendarSource({
    source: {
      id: brandId<CalendarSourceId>({ value: crypto.randomUUID() }),
      kind: 'eventkit',
      label: CALENDAR_CONNECT_COPY.eventkit.name,
      host: null,
      createdAt: nowMs,
    },
  });
  if (!added.isOk) {
    return { kind: 'failed', message: STORE_FAILED };
  }
  const sourceId = added.value.id;
  const chosen = Object.entries(roles).filter(([, role]) => role !== DEFAULT_CALENDAR_ROLE);
  for (const [calendarId, role] of chosen) {
    await state.setCalendarRole({ entry: { sourceId, calendarId, role } });
  }
  return { kind: 'connected' };
};
