import type { ReactNode } from 'react';
import { WORK_META_COLUMN, cn } from '@goodboy/ui';
import { WorkTimeCell } from '../../../../../workTreeModel/components/WorkTimeCell';
import type { WorkTime } from '../../../../../workTreeModel/workTime';

type Props = {
  readonly model?: ReactNode;
  readonly time?: WorkTime | null;
  readonly cost?: string | null;
  readonly isPlanned?: boolean;
  readonly note?: string | null;
};

export const TimelineRowMeta = ({
  model = null,
  time = null,
  cost = null,
  isPlanned = false,
  note = null,
}: Props) => (
  <span data-testid="work-meta" className="flex shrink-0 items-center gap-2">
    {model ?? <span aria-hidden data-meta-column="model" className={WORK_META_COLUMN.model} />}
    <span data-meta-column="stack" className={WORK_META_COLUMN.stack}>
      {time === null ? null : (
        <span
          data-meta-column="time"
          className={cn(WORK_META_COLUMN.stackTime, isPlanned && 'text-faint-foreground')}
        >
          <WorkTimeCell time={time} cost={cost} note={note} />
        </span>
      )}
      {cost === null ? null : (
        <span data-meta-column="cost" className={WORK_META_COLUMN.stackCost}>
          {cost}
        </span>
      )}
    </span>
  </span>
);
