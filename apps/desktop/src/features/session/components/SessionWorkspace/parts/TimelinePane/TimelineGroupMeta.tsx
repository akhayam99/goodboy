import { Tooltip, WorkMeta, formatUsd } from '@goodboy/ui';
import type { GroupTotals } from '../../../../timeline/groupTotals';

type Props = {
  readonly totals: GroupTotals | null;
};

export const TimelineGroupMeta = ({ totals }: Props) => {
  if (totals === null) {
    return null;
  }
  const cost = totals.costUsd > 0 ? formatUsd(totals.costUsd) : null;
  return (
    <WorkMeta
      time={
        totals.time === null ? null : (
          <Tooltip content={totals.time.detail}>
            <span data-testid="work-time">{totals.time.label}</span>
          </Tooltip>
        )
      }
      cost={cost}
    />
  );
};
