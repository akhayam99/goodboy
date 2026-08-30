import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { AnchoredPopover, Button, Tooltip, formatError, useDropdown } from '@goodboy/ui';
import type { ProjectId, SessionId, WorktreeStatus, WorkspaceId } from '@goodboy/types';
import { useToast } from '../../../../../app/components/Toast';
import { useAppStore } from '../../../../../store';
import { isWorkingTreeClean } from '../../../../../shared/lib/gitStatus';

type Props = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly workspaceId: WorkspaceId | undefined;
  readonly projectName: string;
  readonly worktreePath: string;
  readonly worktreeStatus: WorktreeStatus | null;
  readonly triggerClassName: string;
};

export const ProjectDetachMenu = ({
  sessionId,
  projectId,
  workspaceId,
  projectName,
  worktreePath,
  worktreeStatus,
  triggerClassName,
}: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'w-72', expectedHeight: 150 });
  const detachProject = useAppStore((state) => state.detachProject);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const { showToast } = useToast();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDetaching, setIsDetaching] = useState(false);
  const isClean =
    worktreeStatus != null && isWorkingTreeClean({ workingTree: worktreeStatus.workingTree });

  const detach = async () => {
    setIsDetaching(true);
    try {
      await detachProject({ sessionId, projectId });
      dropdown.close();
      if (!isClean) {
        showToast('info', `Worktree kept at ${worktreePath}`);
      }
    } catch (error) {
      void emitNotification(
        'error',
        'warning',
        'could not detach the project',
        formatError(error),
        { sessionId, workspaceId },
      );
    } finally {
      setIsDetaching(false);
    }
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel={`${projectName} actions`}
      trigger={
        <Tooltip content={`${projectName} actions`} anchorClassName="shrink-0">
          <button
            type="button"
            onClick={() => {
              if (dropdown.open) {
                dropdown.close();
                setIsConfirming(false);
                return;
              }
              dropdown.toggle();
            }}
            aria-label={`${projectName} actions`}
            aria-haspopup="menu"
            aria-expanded={dropdown.open}
            className={triggerClassName}
          >
            <MoreHorizontal size={14} aria-hidden />
          </button>
        </Tooltip>
      }
    >
      {isConfirming ? (
        <div className="flex w-72 flex-col gap-2 p-3">
          <span className="text-xs font-medium">{`Detach ${projectName}?`}</span>
          {isClean ? (
            <span className="text-2xs text-muted-foreground">
              Its worktree is clean and will be removed.
            </span>
          ) : (
            <div className="flex min-w-0 flex-col gap-1 text-muted-foreground">
              <span className="text-2xs">Uncommitted changes stay on disk at</span>
              <span className="truncate font-mono text-2xs">{worktreePath}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="text-danger hover:text-danger"
              disabled={isDetaching}
              onClick={() => void detach()}
            >
              {isClean ? 'Detach' : 'Detach, keep changes'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isDetaching}
              onClick={() => setIsConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          role="menuitem"
          onClick={() => setIsConfirming(true)}
          className="flex w-full items-center px-2.5 py-1.5 text-left text-danger/90 transition-colors hover:bg-danger/10 hover:text-danger"
        >
          Detach project
        </button>
      )}
    </AnchoredPopover>
  );
};
