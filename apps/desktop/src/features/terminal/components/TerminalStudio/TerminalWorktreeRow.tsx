import { Folder, GitBranch } from 'lucide-react';
import { cn, ICON_SIZE, ListGridRow, StateDot, TEXT_ROLE } from '@goodboy/ui';

import type { TerminalActivity } from '../../terminalActivityOf';
import type { TerminalWorktree } from '../../terminalWorktrees';

type Props = {
  readonly worktree: TerminalWorktree;
  readonly isSelected: boolean;
  readonly isBusy: boolean;
  readonly activity?: TerminalActivity | null;
  readonly ports: ReadonlyArray<number>;
  readonly onSelect: () => void;
};

const ACTIVITY_TONE: Readonly<Record<TerminalActivity['tone'], string>> = {
  running: 'text-info',
  passed: TEXT_ROLE.hint,
  failed: 'text-danger',
};

type TooltipParams = {
  readonly worktree: TerminalWorktree;
  readonly ports: ReadonlyArray<number>;
  readonly activity: TerminalActivity | null;
};

const tooltipOf = ({ worktree, ports, activity }: TooltipParams): string => {
  const folder = worktree.path ?? worktree.folder ?? worktree.projectName;
  const parts = [
    folder,
    ...(ports.length === 0 ? [] : [ports.map((port) => `:${port}`).join(' ')]),
    ...(activity === null ? [] : [activity.text]),
  ];
  return parts.join(' · ');
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

export const TerminalWorktreeRow = ({
  worktree,
  isSelected,
  isBusy,
  activity = null,
  ports,
  onSelect,
}: Props) => {
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
      tooltip={tooltipOf({ worktree, ports, activity })}
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
          {activity === null ? null : (
            <span
              data-terminal-activity={activity.tone}
              className={cn(
                'min-w-0 max-w-[45%] shrink truncate font-mono text-ui',
                ACTIVITY_TONE[activity.tone],
              )}
            >
              {activity.text}
            </span>
          )}
        </>,
        portCellOf({ ports, isSelected }),
        isBusy ? <StateDot state="running" label="Running a process" isLive /> : '',
      ]}
    />
  );
};
