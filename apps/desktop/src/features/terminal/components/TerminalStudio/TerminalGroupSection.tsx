import { Tooltip, cn } from '@goodboy/ui';
import { useOpenSession } from '../../../../shared/hooks/useOpenSession';
import type { TerminalGroup } from '../../terminalWorktrees';
import { worktreePorts } from '../../worktreePorts';
import { TerminalGroupFacts } from './TerminalGroupFacts';
import { TerminalWorktreeRow } from './TerminalWorktreeRow';

type Props = {
  readonly group: TerminalGroup;
  readonly selectedKey: string | null;
  readonly busyIds: ReadonlySet<string>;
  readonly portsByTerminal: ReadonlyMap<string, ReadonlyArray<number>>;
  readonly onSelect: (key: string) => void;
};

export const TerminalGroupSection = ({
  group,
  selectedKey,
  busyIds,
  portsByTerminal,
  onSelect,
}: Props) => {
  const openSession = useOpenSession();
  const { sessionId } = group;
  return (
    <section aria-label={group.title} className="flex flex-col gap-1">
      <div className="flex min-w-0 flex-col gap-1 px-2">
        {sessionId === null ? (
          <span className="truncate text-label text-muted-foreground">{group.title}</span>
        ) : (
          <Tooltip content={group.title} anchorClassName="flex min-w-0">
            <button
              type="button"
              aria-label={`Open session ${group.title}`}
              onClick={() => openSession({ sessionId })}
              className={cn(
                'min-w-0 truncate rounded-sm text-left text-label text-foreground',
                'hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              )}
            >
              {group.title}
            </button>
          </Tooltip>
        )}
        {sessionId === null ? null : <TerminalGroupFacts sessionId={sessionId} />}
      </div>
      <ul className="flex flex-col gap-0.5">
        {group.worktrees.map((worktree) => (
          <TerminalWorktreeRow
            key={worktree.key}
            worktree={worktree}
            isSelected={worktree.key === selectedKey}
            isBusy={worktree.tabs.some((tab) => busyIds.has(tab.id))}
            ports={worktreePorts({ tabs: worktree.tabs, portsByTerminal })}
            onSelect={() => onSelect(worktree.key)}
          />
        ))}
      </ul>
    </section>
  );
};
