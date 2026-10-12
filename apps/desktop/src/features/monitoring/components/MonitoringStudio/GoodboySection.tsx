import type { MonitorProcess, PortRow } from '@goodboy/core';
import { portLabel } from '../../portLabel';
import { portRowName } from '../../portRowName';
import type { LeftoverRow } from '../../leftoverRows';
import type { StartedRow } from '../../startedByGoodboy';
import { LeftoversList } from './LeftoversList';
import { PortListSection } from './PortListSection';
import { PortRowItem } from './PortRowItem';
import { PortRowMenu } from '../../../actions/PortRowMenu';
import { ProcessRowView } from './ProcessRowView';

type Props = {
  readonly rows: ReadonlyArray<PortRow>;
  readonly processes: ReadonlyArray<StartedRow>;
  readonly leftovers: ReadonlyArray<LeftoverRow>;
  readonly sweptCount: number;
  readonly idleCounts: ReadonlyMap<number, number>;
  readonly processOf: (pid: number | null) => MonitorProcess | null;
  readonly now: number;
};

type SweptParams = {
  readonly count: number;
};

const sweptLine = ({ count }: SweptParams): string =>
  `Stopped ${count} ${count === 1 ? 'process' : 'processes'} left by an earlier run`;

export const GoodboySection = ({
  rows,
  processes,
  leftovers,
  sweptCount,
  idleCounts,
  processOf,
  now,
}: Props) => (
  <PortListSection label="Run by Goodboy" count={rows.length + processes.length}>
    {sweptCount > 0 ? (
      <p role="status" className="px-2 text-meta text-faint-foreground">
        {sweptLine({ count: sweptCount })}
      </p>
    ) : null}
    <ul className="flex flex-col">
      {rows.map((row) => (
        <PortRowItem
          key={row.key}
          row={row}
          process={processOf(row.pid)}
          now={now}
          name={portRowName({ row, isPinned: false })}
          actions={<PortRowMenu port={row.port} layer="goodboy" description={portLabel({ row })} />}
        />
      ))}
      {processes.map((row) => (
        <ProcessRowView key={row.spawnId} row={row} idleCounts={idleCounts} now={now} />
      ))}
    </ul>
    {leftovers.length > 0 ? <LeftoversList rows={leftovers} now={now} /> : null}
  </PortListSection>
);
