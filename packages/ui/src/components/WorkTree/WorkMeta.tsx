import type { ReactNode } from 'react';
import { cn } from '../../cn';
import { WORK_META_COLUMN } from './workMetaSpec';

type Props = {
  readonly routing?: ReactNode;
  readonly time?: ReactNode;
  readonly cost?: ReactNode;
  readonly isPlanned?: boolean;
  readonly isCostRange?: boolean;
};

export const WorkMeta = ({
  routing = null,
  time,
  cost,
  isPlanned = false,
  isCostRange = false,
}: Props) => (
  <span
    data-testid="work-meta"
    className={cn(
      'flex shrink-0 items-center gap-2 text-2xs leading-4 tabular-nums',
      isPlanned ? 'text-faint-foreground' : 'text-muted-foreground',
    )}
  >
    {routing}
    {time === undefined ? null : (
      <span data-meta-column="time" className={WORK_META_COLUMN.time}>
        {time}
      </span>
    )}
    {cost === undefined ? null : (
      <span
        data-meta-column="cost"
        className={isCostRange ? WORK_META_COLUMN.costRange : WORK_META_COLUMN.cost}
      >
        {cost}
      </span>
    )}
  </span>
);
