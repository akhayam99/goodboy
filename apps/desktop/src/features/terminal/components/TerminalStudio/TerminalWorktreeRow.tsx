import { Folder, GitBranch } from 'lucide-react';
import { cn, ICON_SIZE, ListGridRow, StateDot, TEXT_ROLE } from '@goodboy/ui';

import type { TerminalWorktree } from '../../terminalWorktrees';

type Props = {
  readonly worktree: TerminalWorktree;
  readonly isSelected: boolean;
  readonly isBusy: boolean;
  readonly ports: ReadonlyArray<number>;
  readonly onSelect: () => void;
};

type TooltipParams = {
  readonly worktree: TerminalWorktree;
  readonly ports: ReadonlyArray<number>;
};

const tooltipOf = ({ worktree, ports }: TooltipParams): string => {
  const folder = worktree.path ?? worktree.folder ?? worktree.projectName;
  if (ports.length === 0) {
    return folder;
  }
  return `${folder} · ${ports.map((port) => `:${port}`).join(' ')}`;
};

type PortParams = {
  readonly ports: ReadonlyArray<number>;
  readonly isSelected: boolean;
};

const portCellOf = ({ ports, isSelected }: PortParams): string => {
  const first = ports[0];
  if (isSelected || first === undefined) {
    return '';
  }
  return `:${first}`;
};

export const TerminalWorktreeRow = ({ worktree, isSelected, isBusy, ports, onSelect }: Props) => {
  const Icon = worktree.branch === null ? Folder : GitBranch;
  const name =
    worktree.branch === null
      ? worktree.projectName
      : `${worktree.projectName} · ${worktree.branch}`;
  return (
    <ListGridRow
      rowHeight={28}
      isSelected={isSelected}
      ariaLabel={name}
      tooltip={tooltipOf({ worktree, ports })}
      onSelect={onSelect}
      cells={[
        <Icon size={ICON_SIZE.row} aria-hidden className={TEXT_ROLE.hint} />,
        <>
          <span className="min-w-0 max-w-[50%] shrink-0 truncate">{worktree.projectName}</span>
          {worktree.branch === null ? null : (
            <span className={cn('min-w-0 flex-1 truncate font-mono text-ui', TEXT_ROLE.hint)}>
              {worktree.branch}
            </span>
          )}
        </>,
        portCellOf({ ports, isSelected }),
        isBusy ? <StateDot state="running" label="Running a process" isLive /> : '',
      ]}
    />
  );
};
