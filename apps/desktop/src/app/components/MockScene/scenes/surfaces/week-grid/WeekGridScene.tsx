import { PageColumn, WeekGrid, type WeekGridBlock, type WeekGridDay } from '@goodboy/ui';
import { calendarIdentity } from '../../../../../../features/session/timeline/calendarIdentity';
import { ThemedScene } from '../../u37/ThemedScene';

type Props = {
  readonly theme: 'dark' | 'light';
};

const WORK = calendarIdentity({ sourceId: 'scene-mac', calendarId: 'work' });
const FOCUS = calendarIdentity({ sourceId: 'scene-mac', calendarId: 'focus' });
const PERSONAL = calendarIdentity({ sourceId: 'scene-mac', calendarId: 'personal' });

type BlockParams = {
  readonly key: string;
  readonly title: string;
  readonly from: number;
  readonly hours: number;
  readonly color: string;
  readonly isQuiet?: boolean;
};

const HOUR = 60;

const blockOf = ({
  key,
  title,
  from,
  hours,
  color,
  isQuiet = false,
}: BlockParams): WeekGridBlock => ({
  key,
  title,
  startMinute: from * HOUR,
  endMinute: (from + hours) * HOUR,
  color,
  isQuiet,
  ariaLabel: `${String(Math.floor(from)).padStart(2, '0')}:${from % 1 === 0 ? '00' : '30'} ${title}`,
});

const DAYS: ReadonlyArray<WeekGridDay> = [
  {
    key: 'mon',
    label: 'Mon',
    isToday: false,
    blocks: [
      blockOf({ key: 'mon-1', title: 'Harborline planning', from: 9, hours: 1.5, color: WORK }),
      blockOf({ key: 'mon-2', title: 'Focus', from: 13, hours: 1, color: FOCUS }),
    ],
  },
  {
    key: 'tue',
    label: 'Tue',
    isToday: false,
    blocks: [
      blockOf({ key: 'tue-1', title: 'ledger-core standup', from: 8.5, hours: 0.5, color: WORK }),
      blockOf({ key: 'tue-2', title: 'Focus', from: 11, hours: 2, color: FOCUS }),
      blockOf({ key: 'tue-3', title: 'Busy', from: 15, hours: 1, color: PERSONAL, isQuiet: true }),
    ],
  },
  {
    key: 'wed',
    label: 'Wed',
    isToday: false,
    blocks: [
      blockOf({ key: 'wed-1', title: 'ledger-core standup', from: 8.5, hours: 0.5, color: WORK }),
      blockOf({ key: 'wed-2', title: 'notify-relay review', from: 12, hours: 1, color: WORK }),
    ],
  },
  {
    key: 'thu',
    label: 'Thu',
    isToday: true,
    blocks: [
      blockOf({ key: 'thu-1', title: 'Northwind sync', from: 10.5, hours: 0.5, color: WORK }),
      blockOf({ key: 'thu-2', title: 'Focus', from: 12, hours: 1.5, color: FOCUS }),
      blockOf({ key: 'thu-3', title: 'Cascadia review', from: 14, hours: 1, color: WORK }),
      blockOf({
        key: 'thu-4',
        title: 'Busy',
        from: 16.5,
        hours: 1,
        color: PERSONAL,
        isQuiet: true,
      }),
    ],
  },
  {
    key: 'fri',
    label: 'Fri',
    isToday: false,
    blocks: [
      blockOf({ key: 'fri-1', title: 'ledger-core standup', from: 8.5, hours: 0.5, color: WORK }),
      blockOf({ key: 'fri-2', title: 'Focus', from: 10, hours: 3, color: FOCUS }),
    ],
  },
];

const NOOP = () => undefined;

export const WeekGridScene = ({ theme }: Props) => (
  <ThemedScene theme={theme}>
    <main className="flex min-h-screen bg-background py-6 text-foreground">
      <PageColumn>
        <WeekGrid
          ariaLabel="Week"
          days={DAYS}
          fromMinute={8 * HOUR}
          toMinute={18 * HOUR}
          selectedKey="thu-1"
          onSelect={NOOP}
        />
      </PageColumn>
    </main>
  </ThemedScene>
);
