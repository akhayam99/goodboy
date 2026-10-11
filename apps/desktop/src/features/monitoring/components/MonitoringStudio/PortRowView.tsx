import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button, ICON_SIZE, IconButton, StatusDot, cn } from '@goodboy/ui';
import type { MonitorProcess, PortRow } from '@goodboy/core';
import { formatCpu } from '../../formatCpu';
import { formatMemory } from '../../formatMemory';
import { formatUptime } from '../../formatUptime';
import { portLabel } from '../../portLabel';
import { CommandLine } from './CommandLine';
import { OwnerChip } from './OwnerChip';
import { PORT_GRID } from './portGrid';

type Props = {
  readonly row: PortRow;
  readonly process: MonitorProcess | null;
  readonly now: number;
  readonly onWatch?: () => void;
};

type OthersParams = {
  readonly others: number;
};

const otherWorktrees = ({ others }: OthersParams): string =>
  `Also in ${others} other ${others === 1 ? 'worktree' : 'worktrees'}`;

export const PortRowView = ({ row, process, now, onWatch }: Props) => {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const isExternal = row.owner?.kind === 'external';
  const hasCollision = row.collision !== undefined;
  const tone = hasCollision ? 'warning' : 'neutral';

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
        <span className="font-mono tabular-nums text-foreground">:{row.port}</span>
        {onWatch === undefined ? (
          <span className="min-w-0 truncate text-muted-foreground">{portLabel({ row })}</span>
        ) : (
          <Button size="xs" variant="ghost" onClick={onWatch} aria-label={`Watch :${row.port}`}>
            Watch
          </Button>
        )}
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
            <span className="shrink-0 font-mono text-meta tabular-nums text-faint-foreground">
              {row.pid}
            </span>
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
      </div>
      {isCommandOpen && process !== null ? <CommandLine args={process.argsMasked} /> : null}
    </li>
  );
};
