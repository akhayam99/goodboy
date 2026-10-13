import type { MonitorProcess, PortRow } from '@goodboy/core';
import { PinnedRow } from './PinnedRow';
import { PortGroupList } from './PortGroupList';
import { PortListSection } from './PortListSection';

type Props = {
  readonly rows: ReadonlyArray<PortRow>;
  readonly processOf: (pid: number | null) => MonitorProcess | null;
  readonly now: number;
};

export const PinnedSection = ({ rows, processOf, now }: Props) => (
  <PortListSection label="Pinned" count={rows.length}>
    <PortGroupList
      rows={rows}
      processOf={processOf}
      now={now}
      renderRow={({ row, isNested }) => (
        <PinnedRow
          key={row.key}
          row={row}
          process={processOf(row.pid)}
          now={now}
          isNested={isNested}
        />
      )}
    />
  </PortListSection>
);
