import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { openReview } from '../../../../../review/openReview';
import type { RailRow } from '../../../../../workTreeModel/railGeometry';
import type { TimelineResolveBatchEntry } from '../../../../timeline/buildTimelineGroups';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import type { GroupTotals } from '../../../../timeline/groupTotals';
import { TimelineGroupMeta } from './TimelineGroupMeta';
import type { TimelineLaneControl } from './TimelineRail';
import { TimelineStreamRow, type TimelineBranchKey } from './TimelineStreamRow';

type Props = {
  readonly item: TimelineRowItem;
  readonly entry: TimelineResolveBatchEntry;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly sessionId: SessionId;
  readonly totals: GroupTotals | null;
  readonly lanes: TimelineLaneControl | null;
  readonly onBranchKey: TimelineBranchKey | null;
};

export const TimelineGroupStreamRow = ({
  item,
  entry,
  rail,
  railWidth,
  sessionId,
  totals,
  lanes,
  onBranchKey,
}: Props) => {
  const openComments = () => {
    const agentIds = new Set(entry.children.map((child) => child.agent.id));
    const attempts = useAppStore.getState().sessionResolveAttempts[sessionId] ?? [];
    const own = attempts.filter((attempt) => agentIds.has(attempt.agentId));
    void openReview({
      sessionId,
      destination: {
        kind: 'threads',
        mountId: own[0]?.mountTarget?.mountId ?? null,
        threadIds: [...new Set(own.flatMap((attempt) => attempt.threadIds))],
      },
    });
  };
  return (
    <TimelineStreamRow
      item={item}
      rail={rail}
      railWidth={railWidth}
      sessionId={sessionId}
      openTarget={{ label: 'Open comments', open: openComments }}
      action={null}
      meta={<TimelineGroupMeta totals={totals} />}
      lanes={lanes}
      onBranchKey={onBranchKey}
    />
  );
};
