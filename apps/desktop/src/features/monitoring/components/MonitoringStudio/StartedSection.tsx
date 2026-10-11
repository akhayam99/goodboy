import { SectionHeader } from '@goodboy/ui';
import { formatMemory } from '../../formatMemory';
import { formatUptime } from '../../formatUptime';
import type { LeftoverRow } from '../../leftoverRows';
import type { StartedRow } from '../../startedByGoodboy';
import { isStuck } from '../../stuckProcesses';
import { LeftoversList } from './LeftoversList';
import { StopControl } from './StopControl';

type Props = {
  readonly rows: ReadonlyArray<StartedRow>;
  readonly leftovers: ReadonlyArray<LeftoverRow>;
  readonly sweptCount: number;
  readonly idleCounts: ReadonlyMap<number, number>;
  readonly now: number;
};

type SweptParams = {
  readonly count: number;
};

const sweptLine = ({ count }: SweptParams): string =>
  `Stopped ${count} ${count === 1 ? 'process' : 'processes'} left by an earlier run`;

export const StartedSection = ({ rows, leftovers, sweptCount, idleCounts, now }: Props) => (
  <section aria-label="Started by Goodboy" className="flex flex-col gap-2">
    <SectionHeader
      label="Started by Goodboy"
      headingLevel={2}
      meta={<span className="text-meta tabular-nums text-faint-foreground">{rows.length}</span>}
    />
    {sweptCount > 0 ? (
      <p role="status" className="px-2 text-meta text-faint-foreground">
        {sweptLine({ count: sweptCount })}
      </p>
    ) : null}
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li
          key={row.spawnId}
          data-started-row={row.spawnId}
          className="grid min-h-8 grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_3.5rem_4.5rem_5.5rem] items-center gap-3 px-2 text-label"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate text-foreground">{row.name}</span>
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
          <span className="min-w-0 truncate text-muted-foreground">{row.where}</span>
          <span className="text-right tabular-nums text-muted-foreground">
            {formatUptime({ startedAt: row.startedAt, now })}
          </span>
          <span className="text-right tabular-nums text-muted-foreground">
            {formatMemory({ bytes: row.rssBytes })}
          </span>
          <div className="flex justify-end">
            <StopControl pid={row.pid} name={row.name} folder={null} spawnId={row.spawnId} />
          </div>
        </li>
      ))}
    </ul>
    {leftovers.length > 0 ? <LeftoversList rows={leftovers} now={now} /> : null}
  </section>
);
