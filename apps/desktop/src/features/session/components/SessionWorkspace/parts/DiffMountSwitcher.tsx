import type { SessionId, SessionProjectMount } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { useAppStore, useMountDiffStats } from '../../../../../store';
import { DiffStat } from '../../DiffStat';

type Props = {
  readonly sessionId: SessionId;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly selectedWorktreePath: string | null;
};

export const DiffMountSwitcher = ({ sessionId, mounts, selectedWorktreePath }: Props) => {
  const openMountDiff = useAppStore((s) => s.openMountDiff);
  const diffStats = useMountDiffStats(sessionId);

  return (
    <div
      role="group"
      aria-label="Project mounts"
      data-testid="diff-mount-switcher"
      className="flex shrink-0 flex-wrap items-center gap-1 px-6 pt-5"
    >
      {mounts.map((mount) => {
        const stat = diffStats.get(mount.worktreePath) ?? null;
        const hasChanges = stat != null && (stat.additions > 0 || stat.deletions > 0);
        const statState = stat == null ? 'pending' : hasChanges ? 'changed' : 'quiet';
        const isSelected = mount.worktreePath === selectedWorktreePath;
        return (
          <button
            key={mount.worktreePath}
            type="button"
            aria-pressed={isSelected}
            title={mount.worktreePath}
            data-testid="diff-mount-option"
            data-stat={statState}
            onClick={() => openMountDiff(sessionId, mount.worktreePath)}
            className={cn(
              'flex min-w-0 items-center gap-2 rounded-md border px-2 py-1 text-xs transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              isSelected
                ? 'border-border bg-elevated text-foreground shadow-sm'
                : 'border-transparent hover:bg-foreground/5 hover:text-foreground',
              !isSelected && hasChanges && 'text-foreground/80',
              !isSelected && !hasChanges && 'text-muted-foreground/70',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'size-1.5 shrink-0 rounded-full ring-1 ring-inset',
                isSelected ? 'bg-primary ring-primary/40' : 'bg-transparent ring-transparent',
              )}
            />
            <span className={cn('truncate', isSelected && 'font-medium')}>{mount.mountName}</span>
            <span className="flex min-w-16 shrink-0 justify-end">
              {stat == null ? null : hasChanges ? (
                <DiffStat additions={stat.additions} deletions={stat.deletions} />
              ) : (
                <span className="text-3xs tabular-nums text-muted-foreground/50">no changes</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};
