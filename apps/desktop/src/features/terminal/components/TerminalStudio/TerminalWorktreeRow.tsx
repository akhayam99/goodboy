import { Folder, GitBranch } from 'lucide-react';
import { ROW_HOVER, StatusDot, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { TerminalWorktree } from '../../terminalWorktrees';
import { PortChip } from '../PortChip';
import { WorktreeChip } from '../WorktreeChip';

type Props = {
  readonly worktree: TerminalWorktree;
  readonly isSelected: boolean;
  readonly isBusy: boolean;
  readonly ports: ReadonlyArray<number>;
  readonly onSelect: () => void;
};

type CountParams = {
  readonly count: number;
};

const countLabel = ({ count }: CountParams): string =>
  `${count} ${count === 1 ? 'terminal' : 'terminals'}`;

export const TerminalWorktreeRow = ({ worktree, isSelected, isBusy, ports, onSelect }: Props) => {
  const Icon = worktree.branch === null ? Folder : GitBranch;
  const count = worktree.tabs.length;
  return (
    <li data-terminal-worktree={worktree.key} className="flex flex-col">
      <button
        type="button"
        aria-current={isSelected ? 'true' : undefined}
        onClick={onSelect}
        className={cn(
          'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left text-muted-foreground focus-visible:outline-none',
          ROW_HOVER,
          isSelected && 'bg-selected text-foreground',
        )}
      >
        <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 shrink truncate text-label">{worktree.projectName}</span>
            {worktree.kind === 'workspace' || worktree.folder === null ? null : (
              <WorktreeChip folder={worktree.folder} />
            )}
            <span className="flex-1" />
            {isBusy ? (
              <StatusDot tone="warning" size="md" pulsing role="status" ariaLabel="Busy" />
            ) : null}
            <span
              aria-label={countLabel({ count })}
              className="shrink-0 text-meta tabular-nums text-faint-foreground"
            >
              {count}
            </span>
          </span>
          {worktree.branch === null ? null : (
            <span className="truncate font-mono text-meta text-faint-foreground">
              {worktree.branch}
            </span>
          )}
        </span>
      </button>
      {ports.length === 0 ? null : (
        <div className="flex min-w-0 flex-wrap items-center gap-1 px-2 pb-1">
          {ports.map((port) => (
            <PortChip key={port} port={port} />
          ))}
        </div>
      )}
    </li>
  );
};
