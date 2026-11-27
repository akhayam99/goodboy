import { DrawerFrame } from '@goodboy/ui';
import type { CalendarEvent, CalendarRoleEntry, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { formatClock } from '../../../../shared/utils/time/formatClock';
import type { CalendarRow } from '../../calendarRowsOf';
import { eventKindOf } from '../../eventKindOf';
import { eventTitleOf } from '../../eventTitleOf';
import { linkHostOf } from '../../linkHostOf';
import { BeforeCallBlock } from './BeforeCallBlock';
import { CallActions } from './CallActions';
import { EventPeople } from './EventPeople';

type Props = {
  readonly event: CalendarEvent;
  readonly row: CalendarRow | null;
  readonly roles: ReadonlyArray<CalendarRoleEntry>;
  readonly needsYou: ReadonlyArray<Session>;
  readonly now: number;
  readonly onClose: () => void;
};

const BUSY_NOTE = 'Shown as busy only. Goodboy never reads its title.';
const FOCUS_NOTE = 'Agents keep working through this focus block.';

type WhenParams = {
  readonly event: CalendarEvent;
};

const whenOf = ({ event }: WhenParams): string =>
  event.isAllDay
    ? 'All day'
    : `${formatClock({ at: event.start })} to ${formatClock({ at: event.end })}`;

export const CalendarEventDetail = ({ event, row, roles, needsYou, now, onClose }: Props) => {
  const sourceLabel = useAppStore(
    (state) => state.calendarSources.find((source) => source.id === event.sourceId)?.label ?? null,
  );
  const kind = eventKindOf({ event, roles });
  const title = eventTitleOf({ event, kind });
  const host = event.callLink === null ? null : linkHostOf({ link: event.callLink });
  const isEnded = event.end <= now;
  const isCallSoon = row?.isCallSoon ?? false;

  return (
    <DrawerFrame
      title={title}
      icon={CONCEPT_ICONS.calendar}
      meta={joinFacts({ facts: [whenOf({ event }), sourceLabel, host] })}
      onClose={onClose}
    >
      <div data-calendar-event={event.id} className="flex min-w-0 flex-col gap-4">
        {kind === 'busy' ? <p className="text-meta text-muted-foreground">{BUSY_NOTE}</p> : null}
        {kind === 'focus' ? <p className="text-meta text-muted-foreground">{FOCUS_NOTE}</p> : null}
        {kind === 'event' && event.callLink !== null && !isEnded ? (
          <CallActions link={event.callLink} isTrusted={event.isCallLinkTrusted} />
        ) : null}
        {kind === 'event' && isCallSoon && needsYou.length > 0 ? (
          <BeforeCallBlock sessions={needsYou} />
        ) : null}
        {kind === 'event' && event.attendees.length > 0 ? (
          <EventPeople people={event.attendees} />
        ) : null}
      </div>
    </DrawerFrame>
  );
};
