import { ChevronRight } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import type { RailRow } from '../../../../../workTreeModel/railGeometry';
import type {
  TimelineResolveBatchEntry,
  TimelineSubagentGroupEntry,
} from '../../../../timeline/buildTimelineGroups';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import type { TimelineLaneControl } from './TimelineRail';
import { TimelineStreamRow } from './TimelineStreamRow';

type Props = {
  readonly item: TimelineRowItem;
  readonly entry: TimelineResolveBatchEntry | TimelineSubagentGroupEntry;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly sessionId: SessionId;
  readonly isExpanded: boolean;
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
        <ChevronRight
          size={ICON_SIZE.control}
          aria-hidden
          className={cn(
            'shrink-0 self-center text-faint-foreground motion-safe:transition-transform',
            isExpanded && '-rotate-90',
          )}
        />
      }
    />
  );
};
