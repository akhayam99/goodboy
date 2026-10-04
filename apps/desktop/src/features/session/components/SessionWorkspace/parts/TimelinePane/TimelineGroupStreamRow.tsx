import type { SessionId } from '@goodboy/types';
import type { RailRow } from '../../../../../workTreeModel/railGeometry';
import type { TimelineResolveBatchEntry } from '../../../../timeline/buildTimelineGroups';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import type { GroupTotals } from '../../../../timeline/groupTotals';
import { TimelineGroupChevron } from './TimelineGroupChevron';
import { TimelineGroupMeta } from './TimelineGroupMeta';
import type { TimelineLaneControl } from './TimelineRail';
import { TimelineStreamRow } from './TimelineStreamRow';

type Props = {
  readonly item: TimelineRowItem;
  readonly entry: TimelineResolveBatchEntry;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly sessionId: SessionId;
  readonly isExpanded: boolean;
  readonly totals: GroupTotals | null;
  readonly lanes: TimelineLaneControl | null;
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
  lanes,
  onSetExpanded,
}: Props) => {
  const set = ({ isExpanded: next }: { readonly isExpanded: boolean }) =>
    onSetExpanded({ id: entry.id, isExpanded: next });
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
      action={null}
      lanes={lanes}
      meta={
        <>
          <TimelineGroupMeta totals={totals} />
          <TimelineGroupChevron isExpanded={isExpanded} />
        </>
      }
    />
  );
};
