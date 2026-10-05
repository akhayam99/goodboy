import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { openReview } from '../../../../../review/openReview';
import type { RailRow } from '../../../../../workTreeModel/railGeometry';
import type { TimelineResolveBatchEntry } from '../../../../timeline/buildTimelineGroups';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import type { GroupTotals } from '../../../../timeline/groupTotals';
import { TimelineGroupChevron } from './TimelineGroupChevron';
import { TimelineGroupMeta } from './TimelineGroupMeta';
import { TimelineStreamRow } from './TimelineStreamRow';

type Props = {
  readonly item: TimelineRowItem;
  readonly entry: TimelineResolveBatchEntry;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly sessionId: SessionId;
  readonly isExpanded: boolean;
  readonly totals: GroupTotals | null;
  readonly onSetExpanded: (params: { readonly id: string; readonly isExpanded: boolean }) => void;
};

export const TimelineGroupStreamRow = ({
  item,
  entry,
  rail,
  railWidth,
  sessionId,
  isExpanded,
  totals,
  onSetExpanded,
}: Props) => {
  const set = ({ isExpanded: next }: { readonly isExpanded: boolean }) =>
    onSetExpanded({ id: entry.id, isExpanded: next });
  const openComments =
    entry.kind === 'resolveBatch'
      ? () => {
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
        }
      : null;
  return (
    <TimelineStreamRow
      item={item}
      rail={rail}
      railWidth={railWidth}
      sessionId={sessionId}
      openTarget={{
        label: isExpanded ? 'Collapse' : 'Expand',
        open: () => set({ isExpanded: !isExpanded }),
      }}
      expansion={{ isExpanded, controlsId: null, onSet: set }}
      action={openComments === null ? null : { label: 'Open comments', onAct: openComments }}
      meta={
        <>
          <TimelineGroupMeta totals={totals} />
          <TimelineGroupChevron isExpanded={isExpanded} />
        </>
      }
    />
  );
};
