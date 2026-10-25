import { useState } from 'react';
import { ListGridGroup } from '@goodboy/ui';
import {
  ARCHIVED_GROUP_KEY,
  type TerminalGroup,
  type TerminalWorktree,
} from '../../terminalWorktrees';
import { worktreePorts } from '../../worktreePorts';
import { CloseGroupButton } from './CloseGroupButton';
import { TerminalWorktreeRow } from './TerminalWorktreeRow';

type Props = {
  readonly group: TerminalGroup;
  readonly selectedKey: string | null;
  readonly busyIds: ReadonlySet<string>;
  readonly portsByTerminal: ReadonlyMap<string, ReadonlyArray<number>>;
  readonly onSelect: (worktree: TerminalWorktree) => void;
  readonly onCloseAll: (group: TerminalGroup) => void;
};

export const TerminalGroupSection = ({
  group,
  selectedKey,
  busyIds,
  portsByTerminal,
  onSelect,
  onCloseAll,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const rowCount = group.worktrees.length;
  const isArchived = group.key === ARCHIVED_GROUP_KEY;
  const hasSelected = group.worktrees.some((worktree) => worktree.key === selectedKey);
  const isShown = !isArchived || isOpen || hasSelected;
  return (
    <ListGridGroup
      label={group.title}
      headingLevel={2}
      {...(rowCount > 1 && !isArchived && { count: rowCount })}
      {...(isArchived && {
        fold: {
          label: isShown ? 'Hide' : `Show ${rowCount}`,
          onToggle: () => setIsOpen(!isShown),
        },
        action: <CloseGroupButton group={group} onCloseAll={onCloseAll} />,
      })}
    >
      {isShown
        ? group.worktrees.map((worktree) => (
            <TerminalWorktreeRow
              key={worktree.key}
              worktree={worktree}
              isSelected={worktree.key === selectedKey}
              isBusy={worktree.tabs.some((tab) => busyIds.has(tab.id))}
              ports={worktreePorts({ tabs: worktree.tabs, portsByTerminal })}
              onSelect={() => onSelect(worktree)}
            />
          ))
        : null}
    </ListGridGroup>
  );
};
