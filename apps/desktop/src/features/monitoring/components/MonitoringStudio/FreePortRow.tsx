import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import type { PortRow } from '@goodboy/core/monitoring';
import type { PortLayer } from '../../../actions/kinds/port';
import { portAnchorKey } from '../../../actions/portAnchorKey';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { usePortTarget } from '../../hooks/usePortTarget';
import { isPortColumnShown } from './isPortColumnShown';
import type { PortColumns } from './portColumns';
import { PORT_GRIDS } from './portGrid';
import { PortRowActions } from './PortRowActions';
import { usePortColumns } from './usePortColumns';

type Props = {
  readonly row: PortRow;
  readonly layer: PortLayer;
  readonly name: string;
  readonly nameSlot?: ReactNode;
};

const REST_SPAN = {
  full: 'col-span-4',
  compact: 'col-span-3',
  narrow: 'col-span-1',
} as const satisfies Record<PortColumns, string>;

export const FreePortRow = ({ row, layer, name, nameSlot }: Props) => {
  const target = usePortTarget({ row, layer });
  const menu = useObjectMenuTrigger({ target, anchorKey: portAnchorKey({ target }) });
  const columns = usePortColumns({});
  const isLabelShown = isPortColumnShown({ columns, column: 'label' });

  return (
    <li
      data-port-row={row.port}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      className={cn(
        'group/row relative rounded-md',
        PORT_GRIDS[columns],
        'min-h-8 text-meta text-faint-foreground',
      )}
    >
      <span aria-hidden />
      <span className="tabular-nums">:{row.port}</span>
      {isLabelShown ? (nameSlot ?? <span className="min-w-0 truncate">{name}</span>) : null}
      {!isLabelShown && nameSlot !== undefined ? (
        nameSlot
      ) : (
        <span className="min-w-0 truncate">Free</span>
      )}
      <span className={REST_SPAN[columns]} />
      <PortRowActions target={target} hasStop={false} hasMenu />
    </li>
  );
};
