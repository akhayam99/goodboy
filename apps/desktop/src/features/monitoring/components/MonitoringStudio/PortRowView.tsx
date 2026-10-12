import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { ICON_SIZE, IconButton, StatusDot, cn } from '@goodboy/ui';
import type { MonitorProcess, PortRow } from '@goodboy/core';
import { formatCpu } from '../../formatCpu';
import { formatMemory } from '../../formatMemory';
import { formatUptime } from '../../formatUptime';
import { ActionsCell } from './ActionsCell';
import { CommandLine } from './CommandLine';
import { OwnerChip } from './OwnerChip';
import { PORT_GRID } from './portGrid';
import { StopControl } from './StopControl';
import { folderName } from '../../../../store/slices/terminal/terminalOwner';

type Props = {
  readonly row: PortRow;
  readonly process: MonitorProcess | null;
  readonly now: number;
  readonly name: string;
  readonly nameSlot?: ReactNode;
  readonly actions?: ReactNode;
};

type OthersParams = {
  readonly others: number;
};

const otherWorktrees = ({ others }: OthersParams): string =>
  `Also in ${others} other ${others === 1 ? 'worktree' : 'worktrees'}`;

export const PortRowView = ({ row, process, now, name, nameSlot, actions }: Props) => {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const isExternal = row.owner?.kind === 'external';
  const hasCollision = row.collision !== undefined;
  const tone = hasCollision ? 'warning' : 'neutral';
  const spawnId =
    row.owner?.kind === 'script' || row.owner?.kind === 'terminal' || row.owner?.kind === 'agent'
      ? row.owner.spawnId
      : null;
  const stopName = row.processName ?? `Process ${row.pid ?? ''}`.trim();

  return (
    <li data-port-row={row.port} className="flex flex-col">
      <div className={cn(PORT_GRID, 'min-h-8 text-label')}>
        <StatusDot
          tone={tone}
          size="md"
          className={cn(isExternal && !hasCollision && 'opacity-40')}
          role="status"
          ariaLabel={hasCollision ? 'Collision' : 'In use'}
        />
        <span className="tabular-nums text-foreground">:{row.port}</span>
        {nameSlot ?? <span className="min-w-0 truncate text-muted-foreground">{name}</span>}
        <div className="flex min-w-0 flex-col items-start py-1">
          {row.owner === null ? null : <OwnerChip owner={row.owner} />}
          {row.collision === undefined ? null : (
            <span className="truncate text-meta text-warning">
              {otherWorktrees({ others: row.collision.others })}
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1">
          <span className="min-w-0 truncate text-muted-foreground">{row.processName ?? ''}</span>
          {row.pid === null ? null : (
            <span className="shrink-0 text-meta tabular-nums text-faint-foreground">{row.pid}</span>
          )}
          {process === null ? null : (
            <IconButton
              icon={ChevronRight}
              iconSize={ICON_SIZE.row}
              size="xs"
              label={isCommandOpen ? 'Hide command line' : 'Show command line'}
              aria-expanded={isCommandOpen}
              className={cn(isCommandOpen && 'rotate-90')}
              onClick={() => setIsCommandOpen((wasOpen) => !wasOpen)}
            />
          )}
        </div>
        <span className="text-right tabular-nums text-muted-foreground">
          {process === null ? '' : formatUptime({ startedAt: process.startedAt, now })}
        </span>
        <span className="text-right tabular-nums text-muted-foreground">
          {process === null ? '' : formatCpu({ percent: process.cpuPercent })}
        </span>
        <span className="text-right tabular-nums text-muted-foreground">
          {process === null ? '' : formatMemory({ bytes: process.rssBytes })}
        </span>
        <ActionsCell
          stop={
            row.pid === null ? null : (
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
