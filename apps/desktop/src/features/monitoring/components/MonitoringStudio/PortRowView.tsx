import { useState, type ReactNode } from 'react';
import { ROW_HOVER, StatusDot, cn } from '@goodboy/ui';
import type { MonitorProcess, PortRow } from '@goodboy/core';
import type { PortLayer } from '../../../actions/kinds/port';
import { portAnchorKey } from '../../../actions/portAnchorKey';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { usePortTarget } from '../../hooks/usePortTarget';
import { CommandLine } from './CommandLine';
import { MetricCells } from './MetricCells';
import { OwnerCell } from './OwnerCell';
import { PORT_GRID } from './portGrid';
import { PortRowActions } from './PortRowActions';
import { ProcessCell } from './ProcessCell';

type Props = {
  readonly row: PortRow;
  readonly layer: PortLayer;
  readonly process: MonitorProcess | null;
  readonly now: number;
  readonly name: string;
  readonly nameSlot?: ReactNode;
  readonly isNested?: boolean;
};

export const PortRowView = ({
  row,
  layer,
  process,
  now,
  name,
  nameSlot,
  isNested = false,
}: Props) => {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const target = usePortTarget({ row, layer });
  const menu = useObjectMenuTrigger({ target, anchorKey: portAnchorKey({ target }) });
  const hasCollision = row.collision !== undefined;
  const canOpen = process !== null && !isNested;

  return (
    <li
      data-port-row={row.port}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      className={cn('group/row relative flex flex-col rounded-md', canOpen && ROW_HOVER)}
    >
      <div className={cn(PORT_GRID, 'min-h-8 text-meta')}>
        {isNested ? null : hasCollision ? (
          <StatusDot tone="warning" size="md" role="status" ariaLabel="Collision" />
        ) : (
          <span aria-hidden />
        )}
        <span
          className={cn(
            'tabular-nums',
            isNested ? 'col-span-2 pl-8 text-muted-foreground' : 'text-foreground',
          )}
        >
          :{row.port}
        </span>
        {nameSlot ?? <span className="min-w-0 truncate text-muted-foreground">{name}</span>}
        {isNested ? <span /> : <OwnerCell row={row} />}
        {isNested ? (
          <span />
        ) : (
          <ProcessCell
            name={row.processName}
            pid={row.pid}
            toggleLabel={
              canOpen ? (isCommandOpen ? 'Hide command line' : 'Show command line') : undefined
            }
            isOpen={isCommandOpen}
            onToggle={canOpen ? () => setIsCommandOpen((wasOpen) => !wasOpen) : undefined}
          />
        )}
        {isNested ? (
          <>
            <span />
            <span />
            <span />
          </>
        ) : (
          <MetricCells process={process} now={now} />
        )}
        <PortRowActions target={target} hasStop={!isNested} hasMenu />
        {isCommandOpen && process !== null ? <CommandLine args={process.argsMasked} /> : null}
      </div>
    </li>
  );
};
