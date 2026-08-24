import { useState } from 'react';
import { Folder, FolderGit2, GitBranch } from 'lucide-react';
import { AnchoredPopover, Button, Chip, cn, formatError, Tooltip, useDropdown } from '@goodboy/ui';
import type { Project, SessionId, SessionProjectMount } from '@goodboy/types';
import { useAppStore, type MountDiffStat } from '../../../../../../store';
import { BranchSwitchPanel } from '../../../../../worktree/BranchSwitchPanel';
import { DiffStat } from '../../../DiffStat';

const ACTIVE_HINT = 'The header, PR surface and default branch follow this project';
const DETACH_HINT = 'Removes the clean checkout; uncommitted work stays on disk.';

type Props = {
  readonly sessionId: SessionId;
  readonly project: Project;
  readonly mount: SessionProjectMount;
  readonly isActive: boolean;
  readonly canSwitch: boolean;
  readonly diffStat: MountDiffStat | null;
};

export const ProjectRow = ({ sessionId, project, mount, isActive, canSwitch, diffStat }: Props) => {
  const detachProject = useAppStore((state) => state.detachProject);
  const setSessionActiveProject = useAppStore((state) => state.setSessionActiveProject);
  const openMountDiff = useAppStore((state) => state.openMountDiff);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const [isBusy, setIsBusy] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const branchDropdown = useDropdown({ width: 'w-96', expectedHeight: 360 });
  const GlyphIcon = project.kind === 'repo' ? FolderGit2 : Folder;
  const canSwitchBranch = isActive && project.kind === 'repo' && mount.branch !== '';
  const changes =
    diffStat != null && (diffStat.additions > 0 || diffStat.deletions > 0) ? diffStat : null;

  const detach = async () => {
    setIsBusy(true);
    try {
      await detachProject({ sessionId, projectId: project.id });
      setIsConfirming(false);
    } catch (error) {
      void emitNotification(
        'error',
        'warning',
        'could not detach the project',
        formatError(error),
        { sessionId, workspaceId: project.workspaceId },
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-elevated/40 px-3 py-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <GlyphIcon size={14} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground">{project.name}</span>
          {mount.branch !== '' ? (
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <GitBranch size={11} aria-hidden />
              <span className="font-mono">{mount.branch}</span>
            </span>
          ) : null}
          {isActive ? (
            <Tooltip content={ACTIVE_HINT}>
              <span className="shrink-0">
                <Chip tone="primary" size="xs" label="Active" />
              </span>
            </Tooltip>
          ) : null}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs text-muted-foreground/70">{mount.worktreePath}</span>
          {changes != null ? (
            <DiffStat additions={changes.additions} deletions={changes.deletions} size="md" />
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground/50">No changes</span>
          )}
        </div>
      </div>
      {isConfirming ? (
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-foreground">Detach {mount.mountName}?</span>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void detach()}
              className={cn('font-semibold text-danger hover:underline', isBusy && 'opacity-50')}
            >
              Detach
            </button>
            <button
              type="button"
              aria-label="Keep the project mounted"
              onClick={() => setIsConfirming(false)}
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              Keep
            </button>
          </div>
          <span className="text-2xs text-muted-foreground">{DETACH_HINT}</span>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1.5">
          <Tooltip content={`See what changed in ${mount.mountName}`}>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`View the diff of ${mount.mountName}`}
              onClick={() => openMountDiff(sessionId, mount.worktreePath)}
            >
              View diff
            </Button>
          </Tooltip>
          {canSwitchBranch ? (
            <AnchoredPopover
              dropdown={branchDropdown}
              role="dialog"
              ariaLabel="Switch branch"
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  aria-haspopup="dialog"
                  aria-expanded={branchDropdown.open}
                  onClick={branchDropdown.toggle}
                >
                  Switch branch
                </Button>
              }
            >
              <BranchSwitchPanel sessionId={sessionId} onDone={branchDropdown.close} />
            </AnchoredPopover>
          ) : null}
          {canSwitch && !isActive ? (
            <Tooltip content={ACTIVE_HINT}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void setSessionActiveProject({ sessionId, projectId: project.id })}
              >
                Make active
              </Button>
            </Tooltip>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Detach ${mount.mountName}`}
            onClick={() => setIsConfirming(true)}
          >
            Detach
          </Button>
        </div>
      )}
    </div>
  );
};
