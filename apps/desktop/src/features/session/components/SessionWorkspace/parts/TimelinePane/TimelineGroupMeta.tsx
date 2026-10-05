import { formatUsd } from '@goodboy/ui';
import type { GroupTotals } from '../../../../timeline/groupTotals';
import { TimelineRowMeta } from './TimelineRowMeta';

type Props = {
  readonly totals: GroupTotals | null;
};

export const TimelineGroupMeta = ({ totals }: Props) => {
  if (totals === null) {
    return null;
  }
  return (
    <TimelineRowMeta
      time={totals.time}
      cost={totals.costUsd > 0 ? formatUsd(totals.costUsd) : null}
    />
  );
};
