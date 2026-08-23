import { useState } from 'react';
import { Folder, FolderGit2, GitBranch, X } from 'lucide-react';
import { cn, formatError, Tooltip } from '@goodboy/ui';
import type { Project, SessionId, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../../store';

const MANUAL_REASON = 'added manually by the user';

type Props = {
  readonly sessionId: SessionId;
  readonly project: Project;
  readonly mount: SessionProjectMount | null;
  readonly isActive: boolean;
  readonly canSwitch: boolean;
};

export const ProjectScopeChip = ({ sessionId, project, mount, isActive, canSwitch }: Props) => {
  const materializeProject = useAppStore((state) => state.materializeProject);
  const detachProject = useAppStore((state) => state.detachProject);
  const setSessionActiveProject = useAppStore((state) => state.setSessionActiveProject);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const [isBusy, setIsBusy] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const GlyphIcon = project.kind === 'repo' ? FolderGit2 : Folder;

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

  if (mount === null) {
    return (
      <button
        type="button"
        disabled={isBusy}
        onClick={() => void mountProject()}
        title={`Mount ${project.name} into this session`}
        className={cn(
          'flex items-center gap-1 rounded-md border border-dashed border-border-soft px-1.5 py-0.5 text-2xs text-muted-foreground/70 transition-colors',
          'hover:border-border hover:text-foreground',
          isBusy && 'opacity-50',
        )}
      >
        <GlyphIcon size={11} aria-hidden />
        <span>{project.name}</span>
      </button>
    );
  }

  if (isConfirming) {
    return (
      <span className="flex items-center gap-1 rounded-md border border-danger/40 bg-danger/5 px-1.5 py-0.5 text-2xs">
        <span className="text-foreground">Detach {mount.mountName}?</span>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void detach()}
          className={cn('font-semibold text-danger hover:underline', isBusy && 'opacity-50')}
        >
          Detach
        </button>
        <Tooltip content="Keep the project mounted">
          <button
            type="button"
            aria-label="Keep the project mounted"
            onClick={() => setIsConfirming(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={11} aria-hidden />
          </button>
        </Tooltip>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'group/chip flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs transition-colors',
        isActive
          ? 'border-primary/50 bg-primary/10 text-foreground'
          : 'border-border bg-muted/40 text-foreground/90',
      )}
    >
      <button
        type="button"
        disabled={!canSwitch}
        onClick={() => void setSessionActiveProject({ sessionId, projectId: project.id })}
        title={mount.branch === '' ? mount.mountName : `${mount.mountName} on ${mount.branch}`}
        className="flex items-center gap-1"
      >
        <GlyphIcon size={11} aria-hidden />
        <span>{mount.mountName}</span>
        {mount.branch === '' ? null : (
          <GitBranch size={10} aria-hidden className="text-muted-foreground" />
        )}
      </button>
      <Tooltip content={`Detach ${mount.mountName}`}>
        <button
          type="button"
          aria-label={`Detach ${mount.mountName}`}
          onClick={() => setIsConfirming(true)}
          className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/chip:opacity-100 focus-visible:opacity-100"
        >
          <X size={11} aria-hidden />
        </button>
      </Tooltip>
    </span>
  );
};
