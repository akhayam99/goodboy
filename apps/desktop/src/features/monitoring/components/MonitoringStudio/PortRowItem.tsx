import type { ReactNode } from 'react';
import type { MonitorProcess, PortRow } from '@goodboy/core';
import { FreePortRow } from './FreePortRow';
import { PortRowView } from './PortRowView';

type Props = {
  readonly row: PortRow;
  readonly process: MonitorProcess | null;
  readonly now: number;
  readonly name: string;
  readonly nameSlot?: ReactNode;
  readonly actions?: ReactNode;
};

export const PortRowItem = ({ row, process, now, name, nameSlot, actions }: Props) =>
  row.state === 'free' ? (
    <FreePortRow row={row} name={name} nameSlot={nameSlot} actions={actions} />
  ) : (
    <PortRowView
      row={row}
      process={process}
      now={now}
      name={name}
      nameSlot={nameSlot}
      actions={actions}
    />
  );
