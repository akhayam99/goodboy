import type { ReactNode } from 'react';
import { ActivityMeta, WORK_META_COLUMN, cn, type ActivityMetaColumn } from '@goodboy/ui';
import { WorkTimeCell } from '../../../../../workTreeModel/components/WorkTimeCell';
import type { WorkTime } from '../../../../../workTreeModel/workTime';
import { TimelineModelCell } from './TimelineModelCell';

export type TimelineRowMetaLayout = 'stack' | 'feed';

type Props = {
  readonly model?: ReactNode;
  readonly time?: WorkTime | null;
  readonly cost?: string | null;
  readonly isPlanned?: boolean;
  readonly note?: string | null;
  readonly isModelShown?: boolean;
  readonly layout?: TimelineRowMetaLayout;
  readonly state?: ReactNode;
  readonly isLive?: boolean;
};

const FEED_COLUMNS: ReadonlyArray<ActivityMetaColumn> = ['state', 'model', 'time'];

type TimeTone = 'live' | 'planned' | 'quiet';

const TIME_TONE: Record<TimeTone, string | null> = {
  live: 'text-info',
  planned: 'text-faint-foreground',
  quiet: null,
};

type TimeToneParams = {
  readonly isLive: boolean;
  readonly isPlanned: boolean;
};

const timeToneOf = ({ isLive, isPlanned }: TimeToneParams): TimeTone => {
  if (isLive) {
    return 'live';
  }
  return isPlanned ? 'planned' : 'quiet';
};

export const TimelineRowMeta = ({
  model = null,
  time = null,
  cost = null,
  isPlanned = false,
  note = null,
  isModelShown = true,
  layout = 'stack',
  state = null,
  isLive = false,
}: Props) => {
  const modelCell = isModelShown
    ? (model ?? <TimelineModelCell summary={null} isFluid={layout === 'feed'} />)
    : null;
  if (layout === 'feed') {
    const timeTone = timeToneOf({ isLive, isPlanned });
    return (
      <ActivityMeta
        density="feed"
        columns={FEED_COLUMNS}
        state={state}
        model={modelCell}
        time={
          time === null ? null : (
            <span data-time-tone={timeTone} className={cn('min-w-0 truncate', TIME_TONE[timeTone])}>
              <WorkTimeCell time={time} cost={cost} note={note} />
            </span>
          )
        }
      />
    );
  }
  return (
    <span data-testid="work-meta" className="flex shrink-0 items-center gap-2">
      {modelCell}
      <span data-meta-column="stack" className={WORK_META_COLUMN.stack}>
        {time === null ? null : (
          <span
            data-meta-column="time"
            className={cn(WORK_META_COLUMN.stackTime, isPlanned && 'text-faint-foreground')}
          >
            <WorkTimeCell time={time} cost={cost} note={note} />
          </span>
        )}
      </span>
    </span>
  );
};
