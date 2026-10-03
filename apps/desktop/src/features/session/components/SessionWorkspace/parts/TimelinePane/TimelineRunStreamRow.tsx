import { useContext, type ReactNode } from 'react';
import { useObjectMenuTrigger } from '../../../../../actions/useObjectMenuTrigger';
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
import { TimelineRowStateLine } from './TimelineRowStateLine';
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
  readonly menu: ReactNode;
  readonly isRevealed?: boolean;
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
  menu,
  isRevealed = false,
}: Props) => {
  const source = useContext(WorkTimeContext);
  const contextMenu = useObjectMenuTrigger({
    target: { kind: 'workflowRun', sessionId, runId: entry.run.id },
    anchorKey: `activity:${item.id}`,
  });
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
      state={<TimelineRowStateLine state={item.rowState} note={time?.note ?? null} />}
      progress={time?.progress ?? null}
      isRevealed={isRevealed}
      menu={menu}
      contextMenu={contextMenu}
      lanes={lanes}
      runLane={runLane}
    />
  );
};
