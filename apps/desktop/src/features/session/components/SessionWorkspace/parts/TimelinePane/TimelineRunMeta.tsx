import { WORK_META_COLUMN, WorkMeta, formatUsd } from '@goodboy/ui';
import { WorkTimeCell } from '../../../../../workTreeModel/components/WorkTimeCell';
import type { WorkTime } from '../../../../../workTreeModel/workTime';

type Props = {
  readonly progress: string | null;
  readonly time: WorkTime | null | undefined;
  readonly costUsd: number;
};

export const TimelineRunMeta = ({ progress, time, costUsd }: Props) => {
  const cost = costUsd > 0 ? formatUsd(costUsd) : null;
  return (
    <WorkMeta
      routing={
        time === undefined ? undefined : (
          <span data-meta-column="progress" className={WORK_META_COLUMN.routing}>
            <span className={WORK_META_COLUMN.routingName}>{progress}</span>
          </span>
        )
      }
      time={time === undefined ? progress : <WorkTimeCell time={time} cost={cost} />}
      cost={cost}
    />
  );
};
