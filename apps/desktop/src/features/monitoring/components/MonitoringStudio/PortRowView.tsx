import { useState, type ReactNode } from 'react';
import { ROW_HOVER, StatusDot, cn } from '@goodboy/ui';
import type { MonitorProcess, PortRow } from '@goodboy/core';
import { ActionsCell } from './ActionsCell';
import { CommandLine } from './CommandLine';
import { MetricCells } from './MetricCells';
import { OwnerCell } from './OwnerCell';
import { PORT_GRID } from './portGrid';
import { ProcessCell } from './ProcessCell';
import { StopControl } from './StopControl';
import { folderName } from '../../../../store/slices/terminal/terminalOwner';

type Props = {
  readonly row: PortRow;
  readonly process: MonitorProcess | null;
  readonly now: number;
  readonly name: string;
  readonly nameSlot?: ReactNode;
  readonly actions?: ReactNode;
  readonly isNested?: boolean;
};

export const PortRowView = ({
  row,
  process,
  now,
  name,
  nameSlot,
  actions,
  isNested = false,
}: Props) => {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const isExternal = row.owner?.kind === 'external';
  const hasCollision = row.collision !== undefined;
  const tone = hasCollision ? 'warning' : 'neutral';
  const spawnId =
    row.owner?.kind === 'script' || row.owner?.kind === 'terminal' || row.owner?.kind === 'agent'
      ? row.owner.spawnId
      : null;
  const stopName = row.processName ?? `Process ${row.pid ?? ''}`.trim();
  const canOpen = process !== null && !isNested;

  return (
    <li
      data-port-row={row.port}
      className={cn('group/row relative flex flex-col rounded-md', canOpen && ROW_HOVER)}
    >
      <div className={cn(PORT_GRID, 'min-h-8 text-label')}>
        {isNested ? null : (
          <StatusDot
            tone={tone}
            size="md"
            className={cn(isExternal && !hasCollision && 'opacity-40')}
            role="status"
            ariaLabel={hasCollision ? 'Collision' : 'In use'}
          />
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
        <ActionsCell
          stop={
            row.pid === null || isNested ? null : (
              <StopControl
                pid={row.pid}
                name={stopName}
                folder={folderName({ path: process?.cwd ?? null })}
                spawnId={spawnId}
              />
            )
          }
          actions={actions}
        />
        {isCommandOpen && process !== null ? <CommandLine args={process.argsMasked} /> : null}
      </div>
    </li>
  );
};
