import type { MonitorProcess, PortRow } from '@goodboy/core';
import { PinnedRow } from './PinnedRow';
import { PortListSection } from './PortListSection';

type Props = {
  readonly rows: ReadonlyArray<PortRow>;
  readonly processOf: (pid: number | null) => MonitorProcess | null;
  readonly now: number;
};

export const PinnedSection = ({ rows, processOf, now }: Props) => (
  <PortListSection label="Pinned" count={rows.length}>
    <ul className="flex flex-col">
      {rows.map((row) => (
        <PinnedRow key={row.key} row={row} process={processOf(row.pid)} now={now} />
      ))}
    </ul>
  </PortListSection>
);
