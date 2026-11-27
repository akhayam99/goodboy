import type { CalendarSourceKind } from '@goodboy/types';
import { Check, X } from '@goodboy/ui/icons';
import { ICON_SIZE, cn, tintClasses } from '@goodboy/ui';
import { CALENDAR_CONNECT_COPY } from './calendarConnectCopy';
import { ConnectSection } from './ConnectSection';

type Props = {
  readonly kind: CalendarSourceKind;
};

export const CalendarReadsList = ({ kind }: Props) => (
  <ConnectSection label="What Goodboy reads">
    <ul className="flex flex-col gap-1">
      {CALENDAR_CONNECT_COPY[kind].reads.map((read) => {
        const Icon = read.isRead ? Check : X;
        return (
          <li
            key={read.text}
            data-calendar-read={read.isRead ? 'yes' : 'no'}
            className="flex items-start gap-2 text-ui text-muted-foreground"
          >
            <span className="flex h-5 shrink-0 items-center">
              <Icon
                size={ICON_SIZE.row}
                aria-hidden
                className={cn(read.isRead ? tintClasses('success').icon : 'text-faint-foreground')}
              />
            </span>
            <span className="min-w-0">{read.text}</span>
          </li>
        );
      })}
    </ul>
  </ConnectSection>
);
