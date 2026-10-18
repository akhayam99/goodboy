import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import type { PortRow } from '@goodboy/core';
import type { PortLayer } from '../../../actions/kinds/port';
import { portAnchorKey } from '../../../actions/portAnchorKey';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { usePortTarget } from '../../hooks/usePortTarget';
import { PORT_GRID } from './portGrid';
import { PortRowActions } from './PortRowActions';

type Props = {
  readonly row: PortRow;
  readonly layer: PortLayer;
  readonly name: string;
  readonly nameSlot?: ReactNode;
};

export const FreePortRow = ({ row, layer, name, nameSlot }: Props) => {
  const target = usePortTarget({ row, layer });
  const menu = useObjectMenuTrigger({ target, anchorKey: portAnchorKey({ target }) });

  return (
    <li
      data-port-row={row.port}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      className={cn(
        'group/row relative rounded-md',
        PORT_GRID,
        'min-h-8 text-label text-faint-foreground',
      )}
    >
      <span aria-hidden />
      <span className="tabular-nums">:{row.port}</span>
      {nameSlot ?? <span className="min-w-0 truncate">{name}</span>}
      <span className="min-w-0 truncate">Free</span>
      <span className="col-span-4" />
      <PortRowActions target={target} hasStop={false} hasMenu />
    </li>
  );
};
