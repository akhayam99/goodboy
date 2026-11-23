import { brandId, type MountId } from '@goodboy/types';
import { InteractiveRow, TruncatedText } from '@goodboy/ui';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';
import { OverlapChip } from '../../../overlap/OverlapChip';
import type { RunningRow } from '../runningGroupsOf';

type Props = {
  readonly row: RunningRow;
  readonly now: number;
  readonly isFocused: boolean;
  readonly isPeekOpen: boolean;
  readonly hasOverlapChip: boolean;
  readonly onToggle: () => void;
};

export const RunningAgentRow = ({
  row,
  now,
  isFocused,
  isPeekOpen,
  hasOverlapChip,
  onToggle,
}: Props) => (
  <InteractiveRow
    label={`${row.who}: ${row.phrase}`}
    isSelected={isFocused}
    onOpen={onToggle}
    dataAttributes={{
      'data-running-row': row.runId,
      'data-peek-open': isPeekOpen ? 'true' : 'false',
    }}
    className="flex min-h-8 min-w-0 items-center gap-3 px-3"
  >
    <span className="shrink-0 text-ui text-foreground">{row.who}</span>
    <TruncatedText className="min-w-0 flex-1 text-ui text-muted-foreground">
      {row.phrase}
    </TruncatedText>
    {hasOverlapChip && row.mountId !== null ? (
      <OverlapChip mountId={brandId<MountId>({ value: row.mountId })} placement="queue" />
    ) : null}
    {row.project === null ? null : (
      <span className="shrink-0 text-meta text-muted-foreground">{row.project}</span>
    )}
    <span className="shrink-0 text-meta tabular-nums text-faint-foreground">
      {formatSpan({ from: row.startedAt, to: now })}
    </span>
  </InteractiveRow>
);
