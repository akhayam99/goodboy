import type { ReactNode } from 'react';
import { cn } from '../../cn';
import { formatUsd } from '../../format-cost';
import {
  ACTIVITY_META_ORDER,
  ACTIVITY_META_TONE,
  ACTIVITY_META_WIDTH,
  type ActivityMetaColumn,
  type ActivityRowDensity,
} from './activityRowSpec';

type Props = {
  readonly density: ActivityRowDensity;
  readonly columns: ReadonlyArray<ActivityMetaColumn>;
  readonly state?: ReactNode;
  readonly model?: ReactNode;
  readonly time?: ReactNode;
  readonly costUsd?: number | null;
};

type Cell = {
  readonly column: ActivityMetaColumn;
  readonly content: ReactNode;
};

type CostParams = {
  readonly costUsd: number | null;
};

type ContentParams = {
  readonly content: ReactNode;
};

const costOf = ({ costUsd }: CostParams): ReactNode =>
  costUsd !== null && costUsd > 0 ? formatUsd(costUsd) : null;

const isEmpty = ({ content }: ContentParams): boolean =>
  content === null || content === undefined || content === false || content === '';

export const ActivityMeta = ({
  density,
  columns,
  state = null,
  model = null,
  time = null,
  costUsd = null,
}: Props) => {
  const contentOf: Record<ActivityMetaColumn, ReactNode> = {
    state,
    model,
    time,
    cost: costOf({ costUsd }),
  };
  const cells: ReadonlyArray<Cell> = ACTIVITY_META_ORDER.filter((column) =>
    columns.includes(column),
  )
    .map((column) => ({ column, content: contentOf[column] }))
    .filter(({ content }) => density === 'feed' || !isEmpty({ content }));
  return (
    <span data-testid="activity-meta" className="flex shrink-0 items-center gap-2 text-meta">
      {cells.map(({ column, content }) => (
        <span
          key={column}
          data-meta-column={column}
          className={cn(
            'flex shrink-0 items-center overflow-hidden whitespace-nowrap',
            density === 'feed' ? ACTIVITY_META_WIDTH[column] : 'h-5 min-w-8',
            ACTIVITY_META_TONE[column],
          )}
        >
          {content}
        </span>
      ))}
    </span>
  );
};
