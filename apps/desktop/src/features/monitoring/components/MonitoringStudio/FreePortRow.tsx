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
  readonly isNested?: boolean;
};

export const FreePortRow = ({ row, name, nameSlot, actions, isNested = false }: Props) => (
  <li
    data-port-row={row.port}
    className={cn('group/row', PORT_GRID, 'min-h-8 text-label text-faint-foreground')}
  >
    {isNested ? null : <StatusDot tone="neutral" size="md" className="opacity-40" />}
    <span className={cn('tabular-nums', isNested && 'col-span-2 pl-8')}>:{row.port}</span>
    {nameSlot ?? <span className="min-w-0 truncate">{name}</span>}
    <span>Free</span>
    <span className="col-span-4" />
    <ActionsCell actions={actions} isRevealedOnHover />
  </li>
);
