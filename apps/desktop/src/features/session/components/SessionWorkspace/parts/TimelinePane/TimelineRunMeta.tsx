import { WORK_META_COLUMN, WorkMeta, formatUsd } from '@goodboy/ui';
import { WorkTimeCell } from '../../../../../workTreeModel/components/WorkTimeCell';
import type { WorkTime } from '../../../../../workTreeModel/workTime';

type Props = {
  readonly progress: string | null;
  readonly time: WorkTime | null | undefined;
  readonly costUsd: number;
};

export const TimelineRunMeta = ({ progress, time, costUsd }: Props) => (
  <WorkMeta
    shouldKeepCost
    routing={
      time === undefined ? undefined : (
        <>
          <span data-meta-column="progress" className={WORK_META_COLUMN.model}>
            <span className={WORK_META_COLUMN.modelLabel}>{progress}</span>
          </span>
          <span aria-hidden className={WORK_META_COLUMN.effort} />
        </>
      )
    }
    time={time === undefined ? progress : <WorkTimeCell time={time} />}
    cost={costUsd > 0 ? formatUsd(costUsd) : null}
  />
);
