import { useContext } from 'react';
import type { EffortLevel, ProviderId, RoleModelPreferences, SessionId } from '@goodboy/types';
import type { MountDiffStat } from '../../../../../../store';
import { WorkTimeContext } from '../../../../../workTreeModel/workTimeSource';
import type { TimelineOpenTarget } from '../../../../hooks/useTimelineOpen';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import { runStepProgress } from '../../../../timeline/runStepProgress';
import { runWorkTime } from '../../../../timeline/runWorkTime';
import type { RailRow } from '../../../../../workTreeModel/railGeometry';
import type { TimelineLaneControl, TimelineLaneTarget } from './TimelineRail';
import { TimelineRunMeta } from './TimelineRunMeta';
import { TimelineStreamRow, type TimelineRowAction } from './TimelineStreamRow';

type Props = {
  readonly item: TimelineRowItem;
  readonly entry: TimelineRunEntry;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly sessionId: SessionId;
  readonly openTarget: TimelineOpenTarget | null;
  readonly action: TimelineRowAction | null;
  readonly diffStat: MountDiffStat | null;
  readonly lanes: TimelineLaneControl | null;
  readonly runLane: TimelineLaneTarget | null;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: EffortLevel | null;
  readonly costUsd: number;
};

export const TimelineRunStreamRow = ({
  item,
  entry,
  rail,
  railWidth,
  sessionId,
  openTarget,
  action,
  diffStat,
  lanes,
  runLane,
  roleModels,
  sessionProvider,
  sessionEffort,
  costUsd,
}: Props) => {
  const source = useContext(WorkTimeContext);
  const time =
    source === null
      ? undefined
      : runWorkTime({
          entry,
          phase: item.rowState.phase,
          source,
          roleModels,
          sessionProvider,
          sessionEffort,
        });
  return (
    <TimelineStreamRow
      item={item}
      rail={rail}
      railWidth={railWidth}
      sessionId={sessionId}
      openTarget={openTarget}
      action={action}
      diffStat={diffStat}
      meta={<TimelineRunMeta progress={runStepProgress({ entry })} time={time} costUsd={costUsd} />}
      progress={time?.progress ?? null}
      lanes={lanes}
      runLane={runLane}
    />
  );
};
