import { useContext, useMemo } from 'react';
import { useObjectMenuTrigger } from '../../../../../actions/useObjectMenuTrigger';
import type { EffortLevel, ProviderId, RoleModelPreferences, SessionId } from '@goodboy/types';
import { formatUsd } from '@goodboy/ui';
import type { MountDiffStat } from '../../../../../../store';
import { useRoutingScope } from '../../../../../../shared/hooks/useRoutingScope';
import { WorkTimeContext } from '../../../../../workTreeModel/workTimeSource';
import type { TimelineOpenTarget } from '../../../../hooks/useTimelineOpen';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import { modelsSummary, runRanModels } from '../../../../timeline/ranModels';
import { runWorkTime } from '../../../../timeline/runWorkTime';
import type { RailRow } from '../../../../../workTreeModel/railGeometry';
import { RunIdentityCard } from './RunIdentityCard';
import { TimelineModelCell } from './TimelineModelCell';
import type { TimelineLaneControl, TimelineLaneTarget } from './TimelineRail';
import { TimelineRowMeta } from './TimelineRowMeta';
import { TimelineRowStateLine } from './TimelineRowStateLine';
import {
  TimelineStreamRow,
  type TimelineBranchKey,
  type TimelineRowAction,
} from './TimelineStreamRow';

type Props = {
  readonly item: TimelineRowItem;
  readonly entry: TimelineRunEntry;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly sessionId: SessionId;
  readonly openTarget: TimelineOpenTarget | null;
  readonly action: TimelineRowAction | null;
  readonly diffStat: MountDiffStat | null;
  readonly runLane: TimelineLaneTarget | null;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: EffortLevel | null;
  readonly costUsd: number;
  readonly lanes: TimelineLaneControl | null;
  readonly onBranchKey: TimelineBranchKey | null;
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
  runLane,
  roleModels,
  sessionProvider,
  sessionEffort,
  costUsd,
  lanes,
  onBranchKey,
}: Props) => {
  const source = useContext(WorkTimeContext);
  const scope = useRoutingScope({ sessionId });
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
          scope,
        });
  const spans = source?.spans;
  const summary = useMemo(
    () =>
      modelsSummary({
        models: spans === undefined ? [] : runRanModels({ spans, runId: entry.run.id }),
        isRun: true,
      }),
    [spans, entry.run.id],
  );
  const cost = costUsd > 0 ? formatUsd(costUsd) : null;
  return (
    <TimelineStreamRow
      item={item}
      rail={rail}
      railWidth={railWidth}
      sessionId={sessionId}
      openTarget={openTarget}
      action={action}
      diffStat={diffStat}
      identity={{ hasGlyph: true, summary: null, card: <RunIdentityCard entry={entry} /> }}
      meta={
        <TimelineRowMeta
          model={
            <TimelineModelCell
              summary={summary}
              card={summary === null ? null : <RunIdentityCard entry={entry} isModelsOnly />}
            />
          }
          time={time ?? null}
          cost={cost}
        />
      }
      state={
        <TimelineRowStateLine
          state={item.rowState}
          note={item.rowState.phase === 'running' ? (time?.note ?? null) : null}
        />
      }
      progress={time?.progress ?? null}
      contextMenu={contextMenu}
      runLane={runLane}
      lanes={lanes}
      onBranchKey={onBranchKey}
    />
  );
};
