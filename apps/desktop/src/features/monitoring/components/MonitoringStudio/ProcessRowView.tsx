import { StatusDot, cn } from '@goodboy/ui';
import { formatMemory } from '../../formatMemory';
import { formatUptime } from '../../formatUptime';
import type { StartedRow } from '../../startedByGoodboy';
import { isStuck } from '../../stuckProcesses';
import { ActionsCell } from './ActionsCell';
import { PORT_GRID } from './portGrid';
import { StopControl } from './StopControl';

type Props = {
  readonly row: StartedRow;
  readonly idleCounts: ReadonlyMap<number, number>;
  readonly now: number;
};

export const ProcessRowView = ({ row, idleCounts, now }: Props) => (
  <li data-started-row={row.spawnId} className={cn(PORT_GRID, 'min-h-8 text-label')}>
    <StatusDot tone="neutral" size="md" className="opacity-40" />
    <span className="col-span-2 min-w-0 truncate text-foreground">{row.name}</span>
    <span className="min-w-0 truncate text-muted-foreground">{row.where}</span>
    <span className="flex min-w-0 items-center gap-1">
      <span className="shrink-0 text-meta tabular-nums text-faint-foreground">{row.pid}</span>
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
