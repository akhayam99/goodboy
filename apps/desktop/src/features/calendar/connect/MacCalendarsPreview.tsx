import { useState } from 'react';
import {
  brandId,
  DEFAULT_CALENDAR_ROLE,
  type CalendarRole,
  type CalendarSourceId,
  type CalendarSourceRef,
} from '@goodboy/types';
import { CalendarRoleList } from './CalendarRoleList';
import { useCalendarList } from './useCalendarList';

type ChangeParams = {
  readonly calendarId: string;
  readonly role: CalendarRole;
};

type Props = {
  readonly roles: Readonly<Record<string, CalendarRole>>;
  readonly onRoleChange: (params: ChangeParams) => void;
};

const PREVIEW_ID = brandId<CalendarSourceId>({ value: 'this-mac-preview' });

export const MacCalendarsPreview = ({ roles, onRoleChange }: Props) => {
  const [sources] = useState<ReadonlyArray<CalendarSourceRef>>(() => [
    { id: PREVIEW_ID, kind: 'eventkit' },
  ]);
  const listing = useCalendarList({ sources });
  return (
    <CalendarRoleList
      label="Calendars"
      calendars={listing.calendars}
      failure={listing.error ?? listing.failures[0]?.message ?? null}
      isLoading={listing.isLoading}
      roleOf={({ calendar }) => roles[calendar.id] ?? DEFAULT_CALENDAR_ROLE}
      onChange={({ calendar, role }) => onRoleChange({ calendarId: calendar.id, role })}
      onRetry={listing.reload}
    />
  );
};
