import { StatusDot, cn } from '@goodboy/ui';
import { MiddleText } from '../../../../shared/components/MiddleText';
import { formatMemory } from '../../formatMemory';
import { formatUptime } from '../../formatUptime';
import { MIDDLE_TAIL } from '../../middleTail';
import type { StartedRow } from '../../startedByGoodboy';
import { isStuck } from '../../stuckProcesses';
import { ActionsCell } from './ActionsCell';
import { PORT_GRID } from './portGrid';
import { ProcessCell } from './ProcessCell';
import { StopControl } from './StopControl';

type Props = {
  readonly row: StartedRow;
  readonly idleCounts: ReadonlyMap<number, number>;
  readonly now: number;
};

export const ProcessRowView = ({ row, idleCounts, now }: Props) => (
  <li data-started-row={row.spawnId} className={cn(PORT_GRID, 'min-h-8 text-label')}>
    <StatusDot tone="neutral" size="md" className="opacity-40" />
    <span />
    <span className="min-w-0 truncate text-muted-foreground">{row.kindWord}</span>
    <span className="flex min-w-0 text-muted-foreground">
      <MiddleText value={row.where} tail={MIDDLE_TAIL} />
    </span>
    <span className="flex min-w-0 items-center gap-2">
      <ProcessCell name={row.processName} pid={row.pid} />
      {isStuck({
        kind: row.kind,
        pid: row.pid,
        startedAt: row.startedAt,
        now,
        idleCounts,
      }) ? (
        <span className="shrink-0 text-meta text-warning">Looks stuck</span>
      ) : null}
    </span>
    <span className="text-right tabular-nums text-muted-foreground">
      {formatUptime({ startedAt: row.startedAt, now })}
    </span>
    <span />
    <span className="text-right tabular-nums text-muted-foreground">
      {formatMemory({ bytes: row.rssBytes })}
    </span>
    <ActionsCell
      stop={<StopControl pid={row.pid} name={row.name} folder={null} spawnId={row.spawnId} />}
    />
  </li>
);
