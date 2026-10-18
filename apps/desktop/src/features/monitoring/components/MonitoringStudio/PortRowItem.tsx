import type { ReactNode } from 'react';
import type { MonitorProcess, PortRow } from '@goodboy/core';
import type { PortLayer } from '../../../actions/kinds/port';
import { FreePortRow } from './FreePortRow';
import { PortRowView } from './PortRowView';

type Props = {
  readonly row: PortRow;
  readonly layer: PortLayer;
  readonly process: MonitorProcess | null;
  readonly now: number;
  readonly name: string;
  readonly nameSlot?: ReactNode;
  readonly isNested?: boolean;
};

export const PortRowItem = ({ row, layer, process, now, name, nameSlot, isNested }: Props) =>
  row.state === 'free' ? (
    <FreePortRow row={row} layer={layer} name={name} nameSlot={nameSlot} />
  ) : (
    <PortRowView
      row={row}
      layer={layer}
      process={process}
      now={now}
      name={name}
      nameSlot={nameSlot}
      isNested={isNested}
    />
  );
