import type {
  CalendarAccessState,
  CalendarInfo,
  CalendarList,
  CalendarSourceRef,
} from '@goodboy/types';
import { invokeCommand } from '../../../shared/lib/invokeCommand';

type CalendarLink = Readonly<{
  id: string;
  label: string;
  host: string;
}>;

type ListParams = {
  readonly sources: ReadonlyArray<CalendarSourceRef>;
};

type AddLinkParams = {
  readonly label: string;
  readonly url: string;
};

type RemoveLinkParams = {
  readonly id: string;
};

export const calendarCommands = {
  accessState: (): Promise<CalendarAccessState> =>
    invokeCommand<CalendarAccessState>('calendar_access_state'),
  requestAccess: (): Promise<CalendarAccessState> =>
    invokeCommand<CalendarAccessState>('calendar_request_access'),
  listCalendars: ({ sources }: ListParams): Promise<CalendarList<CalendarInfo>> =>
    invokeCommand<CalendarList<CalendarInfo>>('calendar_list_calendars', { sources }),
  addLink: ({ label, url }: AddLinkParams): Promise<CalendarLink> =>
    invokeCommand<CalendarLink>('calendar_ics_add', { label, url }),
  removeLink: ({ id }: RemoveLinkParams): Promise<void> =>
    invokeCommand<void>('calendar_ics_remove', { id }),
  openPrivacySettings: (): Promise<void> =>
    invokeCommand<void>('open_privacy_settings', { pane: 'calendars' }),
};
