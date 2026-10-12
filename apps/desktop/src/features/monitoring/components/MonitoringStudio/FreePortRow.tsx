import type { ReactNode } from 'react';
import { StatusDot, cn } from '@goodboy/ui';
import type { PortRow } from '@goodboy/core';
import { ActionsCell } from './ActionsCell';
import { PORT_GRID } from './portGrid';

type Props = {
  readonly row: PortRow;
  readonly name: string;
  readonly nameSlot?: ReactNode;
  readonly actions?: ReactNode;
};

export const FreePortRow = ({ row, name, nameSlot, actions }: Props) => (
  <li
    data-port-row={row.port}
    className={cn(PORT_GRID, 'min-h-8 text-label text-faint-foreground')}
  >
    <StatusDot tone="neutral" size="md" className="opacity-40" />
    <span className="tabular-nums">:{row.port}</span>
    {nameSlot ?? <span className="min-w-0 truncate">{name}</span>}
    <span className="col-span-5">Free</span>
    <ActionsCell actions={actions} />
  </li>
);
