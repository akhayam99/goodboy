import { WorkMeta, formatUsd } from '@goodboy/ui';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import { runStepProgress } from '../../../../timeline/runStepProgress';

type Props = {
  readonly entry: TimelineRunEntry;
  readonly costUsd: number;
};

export const TimelineRunMeta = ({ entry, costUsd }: Props) => (
  <WorkMeta
    shouldKeepCost
    time={runStepProgress({ entry })}
    cost={costUsd > 0 ? formatUsd(costUsd) : null}
  />
);
