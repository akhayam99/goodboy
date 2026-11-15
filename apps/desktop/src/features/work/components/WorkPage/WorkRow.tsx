import { Button, cn, formatUsd, InteractiveRow, tintClasses, TruncatedText } from '@goodboy/ui';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';
import { workAgentsTextOf } from '../../workAgentsTextOf';
import { workLeadMetaOf } from '../../workLeadMetaOf';
import type { WorkRow as Row } from '../../workRowsOf';
import { workStateOf } from '../../workStateOf';
import { WorkRowDot } from './WorkRowDot';
import { WORK_ROW_GRID } from './workRowGrid';

type Props = {
  readonly row: Row;
  readonly projectName: string | null;
  readonly onOpen: () => void;
};

export const WorkRow = ({ row, projectName, onOpen }: Props) => {
  const now = useNow(30_000);
  const state = workStateOf({ lead: row.lead, askCount: row.askCount });
  return (
    <InteractiveRow
      label={`Open ${row.title}`}
      isSelected={false}
      onOpen={onOpen}
      dataAttributes={{ 'data-work-row': row.treeId }}
      className={WORK_ROW_GRID.frame}
    >
      <WorkRowDot tone={state.tone} label={state.text} isLive={row.lead.stop === 'working'} />
      <span className="flex min-w-0 flex-col">
        <TruncatedText isFocusable className="min-w-0 truncate text-row text-foreground">
          {row.title}
        </TruncatedText>
        <span className="min-w-0 truncate text-meta text-muted-foreground">
          {workLeadMetaOf({ row, projectName })}
        </span>
      </span>
      <span
        className={cn(
          WORK_ROW_GRID.state,
          state.tone === 'warning' ? tintClasses('warning').text : 'text-muted-foreground',
        )}
      >
        {state.text}
      </span>
      <span className={WORK_ROW_GRID.action}>
        {state.action === null ? null : (
          <Button size="sm" variant="primary" onClick={onOpen}>
            {state.action}
          </Button>
        )}
      </span>
      <span className={WORK_ROW_GRID.number}>{workAgentsTextOf({ row })}</span>
      <span className={WORK_ROW_GRID.number}>{formatUsd(row.spentUsd)}</span>
      <span className={WORK_ROW_GRID.number}>{formatSpan({ from: row.updatedAt, to: now })}</span>
    </InteractiveRow>
  );
};
