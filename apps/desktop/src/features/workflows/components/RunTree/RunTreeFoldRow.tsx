import { useContext } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ICON_SIZE, formatUsd } from '@goodboy/ui';
import type { AgentId } from '@goodboy/types';
import type { TimelineCountItem } from '../../../session/timeline/buildTimelineStream';
import { TimelineCountRow } from '../../../session/components/SessionWorkspace/parts/TimelinePane/TimelineCountRow';
import { RAIL_COUNT_RADIUS, type RailRow } from '../../../workTreeModel/railGeometry';
import { formatActiveTime } from '../../../workTreeModel/workTime';
import { WorkTimeContext, familyActiveTime } from '../../../workTreeModel/workTimeSource';
import { foldRowSummary } from './foldRowSummary';
import { rowSlotWidth } from './rowSlotWidth';

type SetParams = {
  readonly id: string;
  readonly isExpanded: boolean;
};

type Props = {
  readonly item: TimelineCountItem;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly childIds: ReadonlyArray<AgentId>;
  readonly costUsd: number;
  readonly onSet: (params: SetParams) => void;
};

export const RunTreeFoldRow = ({ item, rail, railWidth, childIds, costUsd, onSet }: Props) => {
  const source = useContext(WorkTimeContext);
  const active = source === null ? null : familyActiveTime({ agentIds: childIds, source });
  const summary = foldRowSummary({
    summary: item.summary,
    duration:
      active === null || active.activeMs <= 0 ? null : formatActiveTime({ ms: active.activeMs }),
    cost: costUsd > 0 ? formatUsd(costUsd) : null,
  });
  const Chevron = item.isExpanded ? ChevronUp : ChevronDown;
  return (
    <div data-testid="run-tree-fold-row">
      <TimelineCountRow
        item={{ ...item, summary }}
        rail={rail}
        railWidth={rowSlotWidth({
          rail,
          railWidth,
          isNested: true,
          markerRadius: RAIL_COUNT_RADIUS,
        })}
        lanes={null}
        isExpanded={item.isExpanded}
        hasGutter={false}
        trailing={
          <Chevron size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
        }
        onSet={onSet}
      />
    </div>
  );
};
