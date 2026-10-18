import type { MonitorProcess, PortRow } from '@goodboy/core';
import { portRowName } from '../../portRowName';
import { PortListSection } from './PortListSection';
import { PortRowItem } from './PortRowItem';

type Props = {
  readonly rows: ReadonlyArray<PortRow>;
  readonly processOf: (pid: number | null) => MonitorProcess | null;
  readonly now: number;
};

export const WorkspaceSection = ({ rows, processOf, now }: Props) => (
  <PortListSection
    label="From workspace"
    layer="workspace"
    rows={rows}
    processOf={processOf}
    now={now}
    renderRow={({ row, isNested }) => (
      <PortRowItem
        key={row.key}
        row={row}
        layer="workspace"
        process={processOf(row.pid)}
        now={now}
        name={portRowName({ row, isPinned: false })}
        isNested={isNested}
      />
    )}
  />
);
