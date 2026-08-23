import { useState } from 'react';
import { Folder, FolderGit2, GitBranch } from 'lucide-react';
import { AnchoredPopover, Button, Chip, cn, formatError, useDropdown } from '@goodboy/ui';
import type { Project, SessionId, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { BranchSwitchPanel } from '../../../../../worktree/BranchSwitchPanel';

const MANUAL_REASON = 'added manually by the user';

type Props = {
  readonly sessionId: SessionId;
  readonly project: Project;
  readonly mount: SessionProjectMount | null;
  readonly isActive: boolean;
  readonly canSwitch: boolean;
};

export const ProjectRow = ({ sessionId, project, mount, isActive, canSwitch }: Props) => {
  const materializeProject = useAppStore((state) => state.materializeProject);
  const detachProject = useAppStore((state) => state.detachProject);
  const setSessionActiveProject = useAppStore((state) => state.setSessionActiveProject);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const [isBusy, setIsBusy] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const branchDropdown = useDropdown({ width: 'w-96', expectedHeight: 360 });
  const GlyphIcon = project.kind === 'repo' ? FolderGit2 : Folder;
  const canSwitchBranch =
    mount != null && isActive && project.kind === 'repo' && mount.branch !== '';

  const notifyFailure = (title: string, error: unknown) => {
    void emitNotification('error', 'warning', title, formatError(error), {
      sessionId,
      workspaceId: project.workspaceId,
    });
  };

  const mountProject = async () => {
    setIsBusy(true);
    try {
      await materializeProject({ sessionId, projectId: project.id, reason: MANUAL_REASON });
    } catch (error) {
      notifyFailure('could not add the project', error);
    } finally {
      setIsBusy(false);
    }
  };

  const detach = async () => {
    setIsBusy(true);
    try {
      await detachProject({ sessionId, projectId: project.id });
      setIsConfirming(false);
    } catch (error) {
      notifyFailure('could not detach the project', error);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border px-3 py-2',
        mount != null ? 'border-border bg-elevated/40' : 'border-dashed border-border-soft',
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <GlyphIcon size={14} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground">{project.name}</span>
          {mount != null && mount.branch !== '' ? (
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <GitBranch size={11} aria-hidden />
              <span className="font-mono">{mount.branch}</span>
            </span>
          ) : null}
          {isActive ? <Chip tone="primary" size="xs" label="Active" className="shrink-0" /> : null}
        </div>
        {mount != null ? (
          <span className="truncate text-xs text-muted-foreground/70">{mount.worktreePath}</span>
        ) : null}
      </div>
      {mount == null ? (
        <Button variant="secondary" size="sm" disabled={isBusy} onClick={() => void mountProject()}>
          Mount
        </Button>
      ) : isConfirming ? (
        <div className="flex shrink-0 items-center gap-2 text-xs">
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
      ) : (
        <div className="flex shrink-0 items-center gap-1.5">
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void setSessionActiveProject({ sessionId, projectId: project.id })}
            >
              Make active
            </Button>
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
