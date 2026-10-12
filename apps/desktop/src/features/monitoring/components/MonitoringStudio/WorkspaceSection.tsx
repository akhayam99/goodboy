import type { MonitorProcess, PortRow } from '@goodboy/core';
import { portLabel } from '../../portLabel';
import { portRowName } from '../../portRowName';
import { PortListSection } from './PortListSection';
import { PortRowItem } from './PortRowItem';
import { PortRowMenu } from '../../../actions/PortRowMenu';

type Props = {
  readonly rows: ReadonlyArray<PortRow>;
  readonly processOf: (pid: number | null) => MonitorProcess | null;
  readonly now: number;
};

export const WorkspaceSection = ({ rows, processOf, now }: Props) => (
  <PortListSection label="From workspace" count={rows.length}>
    <ul className="flex flex-col">
      {rows.map((row) => (
        <PortRowItem
          key={row.key}
          row={row}
          process={processOf(row.pid)}
          now={now}
          name={portRowName({ row, isPinned: false })}
          actions={
            <PortRowMenu port={row.port} layer="workspace" description={portLabel({ row })} />
          }
        />
      ))}
    </ul>
  </PortListSection>
);
