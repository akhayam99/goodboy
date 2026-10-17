import type { ReactNode } from 'react';
import { WORK_META_COLUMN, cn } from '@goodboy/ui';
import { WorkTimeCell } from '../../../../../workTreeModel/components/WorkTimeCell';
import type { WorkTime } from '../../../../../workTreeModel/workTime';
import { TimelineModelCell } from './TimelineModelCell';

type Props = {
  readonly model?: ReactNode;
  readonly time?: WorkTime | null;
  readonly cost?: string | null;
  readonly isPlanned?: boolean;
  readonly note?: string | null;
  readonly isModelShown?: boolean;
};

export const TimelineRowMeta = ({
  model = null,
  time = null,
  cost = null,
  isPlanned = false,
  note = null,
  isModelShown = true,
}: Props) => (
  <span data-testid="work-meta" className="flex shrink-0 items-center gap-2">
    {isModelShown ? (model ?? <TimelineModelCell summary={null} />) : null}
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
