import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { TerminalWorktree } from '../../terminalWorktrees';
import { WorktreeChip } from '../WorktreeChip';

type Props = {
  readonly worktree: TerminalWorktree;
};

export const TerminalHeader = ({ worktree }: Props) => (
  <div className="flex min-h-8 shrink-0 items-center gap-2 px-3">
    <CONCEPT_ICONS.terminal
      size={ICON_SIZE.control}
      aria-hidden
      className="shrink-0 text-faint-foreground"
    />
    <h2 className="min-w-0 shrink truncate text-heading text-foreground">{worktree.projectName}</h2>
    {worktree.kind === 'workspace' || worktree.folder === null ? null : (
      <WorktreeChip folder={worktree.folder} />
    )}
    <span className="flex-1" />
    {worktree.sessionId === null ? null : (
      <OpenSessionButton sessionId={worktree.sessionId} variant="ghost" />
    )}
  </div>
);
