import { ListGridGroup } from '@goodboy/ui';
import type { TerminalGroup, TerminalWorktree } from '../../terminalWorktrees';
import { worktreePorts } from '../../worktreePorts';
import { TerminalWorktreeRow } from './TerminalWorktreeRow';

type Props = {
  readonly group: TerminalGroup;
  readonly selectedKey: string | null;
  readonly busyIds: ReadonlySet<string>;
  readonly portsByTerminal: ReadonlyMap<string, ReadonlyArray<number>>;
  readonly onSelect: (worktree: TerminalWorktree) => void;
};

export const TerminalGroupSection = ({
  group,
  selectedKey,
  busyIds,
  portsByTerminal,
  onSelect,
}: Props) => {
  const rowCount = group.worktrees.length;
  return (
    <ListGridGroup label={group.title} headingLevel={2} {...(rowCount > 1 && { count: rowCount })}>
      {group.worktrees.map((worktree) => (
        <TerminalWorktreeRow
          key={worktree.key}
          worktree={worktree}
          isSelected={worktree.key === selectedKey}
          isBusy={worktree.tabs.some((tab) => busyIds.has(tab.id))}
          ports={worktreePorts({ tabs: worktree.tabs, portsByTerminal })}
          onSelect={() => onSelect(worktree)}
        />
      ))}
    </ListGridGroup>
  );
};
