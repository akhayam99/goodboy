import { Button } from '@goodboy/ui';
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
        <h3 className="text-label text-warning">Leftovers</h3>
        <Button
          size="xs"
          variant="secondary"
          disabled={isStopping}
          onClick={() => void stopLeftovers({ pids })}
        >
          {isStopping ? 'Stopping' : `Stop leftovers (${rows.length})`}
        </Button>
      </div>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li
            key={row.spawnId}
            data-leftover-row={row.spawnId}
            className="flex min-h-8 items-center gap-3 px-2 text-label"
          >
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              <span className="text-foreground">{row.name}</span> · {row.startedBy}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {formatUptime({ startedAt: row.startedAt, now })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
