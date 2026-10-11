import { SectionHeader } from '@goodboy/ui';
import { formatMemory } from '../../formatMemory';
import { formatUptime } from '../../formatUptime';
import type { StartedRow } from '../../startedByGoodboy';

type Props = {
  readonly rows: ReadonlyArray<StartedRow>;
  readonly now: number;
};

export const StartedSection = ({ rows, now }: Props) => (
  <section aria-label="Started by Goodboy" className="flex flex-col gap-2">
    <SectionHeader
      label="Started by Goodboy"
      headingLevel={2}
      meta={<span className="text-meta tabular-nums text-faint-foreground">{rows.length}</span>}
    />
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li
          key={row.spawnId}
          data-started-row={row.spawnId}
          className="grid min-h-8 grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_3.5rem_4.5rem] items-center gap-3 px-2 text-label"
        >
          <span className="min-w-0 truncate text-foreground">{row.name}</span>
          <span className="min-w-0 truncate text-muted-foreground">{row.where}</span>
          <span className="text-right tabular-nums text-muted-foreground">
            {formatUptime({ startedAt: row.startedAt, now })}
          </span>
          <span className="text-right tabular-nums text-muted-foreground">
            {formatMemory({ bytes: row.rssBytes })}
          </span>
        </li>
      ))}
    </ul>
  </section>
);
