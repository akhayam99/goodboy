import { Button, StatusDot, cn } from '@goodboy/ui';
import { PORT_GRID } from './portGrid';
import { useAppStore } from '../../../../store';
import { formatUptime } from '../../formatUptime';
import type { LeftoverRow } from '../../leftoverRows';

type Props = {
  readonly rows: ReadonlyArray<LeftoverRow>;
  readonly now: number;
};

export const LeftoversList = ({ rows, now }: Props) => {
  const stopLeftovers = useAppStore((state) => state.stopLeftovers);
  const stopping = useAppStore((state) => state.monitorStopping);
  const pids = rows.flatMap((row) => row.pids);
  const isStopping = pids.some((pid) => stopping[pid] === 'stopping');

  return (
    <div role="group" aria-label="Leftovers" className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 px-2">
        <h3 className="flex items-center gap-1 text-meta text-foreground">
          Leftovers
          {rows.length > 1 ? (
            <span className="text-meta tabular-nums text-faint-foreground">{rows.length}</span>
          ) : null}
        </h3>
        <Button
          size="xs"
          variant="secondary"
          disabled={isStopping}
          onClick={() => void stopLeftovers({ pids })}
        >
          {isStopping ? 'Stopping' : 'Stop leftovers'}
        </Button>
      </div>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li
            key={row.spawnId}
            data-leftover-row={row.spawnId}
            className={cn(PORT_GRID, 'min-h-8 text-meta')}
          >
            <StatusDot tone="warning" size="md" />
            <span />
            <span className="min-w-0 truncate text-foreground">{row.name}</span>
            <span className="min-w-0 truncate text-muted-foreground">{row.startedBy}</span>
            <span />
            <span className="text-right tabular-nums text-muted-foreground">
              {formatUptime({ startedAt: row.startedAt, now })}
            </span>
            <span />
            <span />
            <span />
          </li>
        ))}
      </ul>
    </div>
  );
};
