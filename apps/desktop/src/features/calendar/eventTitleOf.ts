import type { CalendarEvent } from '@goodboy/types';
import type { CalendarEventKind } from './eventKindOf';

const BUSY_TITLE = 'Busy';

type Params = {
  readonly event: CalendarEvent;
  readonly kind: CalendarEventKind;
};

export const eventTitleOf = ({ event, kind }: Params): string =>
  kind === 'busy' || event.title.trim() === '' ? BUSY_TITLE : event.title;
