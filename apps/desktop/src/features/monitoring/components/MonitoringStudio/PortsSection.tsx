import { SectionHeader } from '@goodboy/ui';
import type { MonitorProcess, PortRow } from '@goodboy/core';
import { FreePortRow } from './FreePortRow';
import { PortRowView } from './PortRowView';

type Props = {
  readonly rows: ReadonlyArray<PortRow>;
  readonly processOf: (pid: number | null) => MonitorProcess | null;
  readonly now: number;
};

export const PortsSection = ({ rows, processOf, now }: Props) => (
  <section aria-label="Ports" className="flex flex-col gap-2">
    <SectionHeader
      label="Ports"
      headingLevel={2}
      meta={<span className="text-meta tabular-nums text-faint-foreground">{rows.length}</span>}
    />
    <ul className="flex flex-col">
      {rows.map((row) =>
        row.state === 'free' ? (
          <FreePortRow key={row.key} row={row} />
        ) : (
          <PortRowView key={row.key} row={row} process={processOf(row.pid)} now={now} />
        ),
      )}
    </ul>
  </section>
);
