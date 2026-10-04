import type { SessionId } from '@goodboy/types';
import { useObjectMenuTrigger } from '../../../../../actions/useObjectMenuTrigger';
import type { RailRow } from '../../../../../workTreeModel/railGeometry';
import type {
  TimelineAgentEntry,
  TimelineRunEntry,
} from '../../../../timeline/buildTimelineGroups';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import type { GroupTotals } from '../../../../timeline/groupTotals';
import { TimelineGroupChevron } from './TimelineGroupChevron';
import { TimelineGroupMeta } from './TimelineGroupMeta';
import type { TimelineLaneControl, TimelineLaneTarget } from './TimelineRail';
import { TimelineRowStateLine } from './TimelineRowStateLine';
import { TimelineStreamRow } from './TimelineStreamRow';

type Props = {
  readonly item: TimelineRowItem;
  readonly entry: TimelineRunEntry | TimelineAgentEntry;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly sessionId: SessionId;
  readonly isExpanded: boolean;
  readonly totals: GroupTotals | null;
  readonly lanes: TimelineLaneControl | null;
  readonly runLane: TimelineLaneTarget | null;
  readonly onSetExpanded: (params: { readonly id: string; readonly isExpanded: boolean }) => void;
  readonly provider?: string | null;
};

export const TimelineFoldStreamRow = ({
  item,
  entry,
  rail,
  railWidth,
  sessionId,
  isExpanded,
  totals,
  lanes,
  runLane,
  onSetExpanded,
  provider = null,
}: Props) => {
  const contextMenu = useObjectMenuTrigger({
    target:
      entry.kind === 'run'
        ? { kind: 'workflowRun', sessionId, runId: entry.run.id }
        : { kind: 'agent', sessionId, agentId: entry.agent.id },
    anchorKey: `activity:${item.id}`,
  });
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
      state={<TimelineRowStateLine state={item.rowState} note={null} />}
      meta={
        <>
          <TimelineGroupMeta totals={totals} />
          <TimelineGroupChevron isExpanded={isExpanded} />
        </>
      }
      contextMenu={contextMenu}
      lanes={lanes}
      runLane={runLane}
      provider={provider}
    />
  );
};
