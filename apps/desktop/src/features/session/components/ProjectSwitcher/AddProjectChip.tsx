import { useState } from 'react';
import { cn, formatError, Popover, useDropdown } from '@goodboy/ui';
import { FolderGit2, Plus } from 'lucide-react';
import type { ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { preferredProject } from '../../../../store/slices/projects/preferredProject';

const EMPTY_MOUNTS: ReadonlyArray<SessionProjectMount> = [];

const MANUAL_REASON = 'added manually by the user';

type Props = {
  readonly sessionId: SessionId;
};

export const AddProjectChip = ({ sessionId }: Props) => {
  const session = useAppStore(
    (state) => state.sessions.find((candidate) => candidate.id === sessionId) ?? null,
  );
  const projects = useAppStore((state) => state.projects);
  const profile = useAppStore((state) =>
    session === null
      ? undefined
      : state.workspaces?.find((candidate) => candidate.id === session.workspaceId)?.profile,
  );
  const mounts = useAppStore((state) => state.sessionProjectMounts[sessionId] ?? EMPTY_MOUNTS);
  const materializeProject = useAppStore((state) => state.materializeProject);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const { open, close, toggle, containerRef, popupClassName } = useDropdown({ disabled: false });
  const [busyProjectId, setBusyProjectId] = useState<ProjectId | null>(null);

  const unmaterialized =
    session === null
      ? []
      : projects.filter(
          (project) =>
            project.workspaceId === session.workspaceId &&
            !mounts.some((mount) => mount.projectId === project.id),
        );
  const preferred = preferredProject({ projects: unmaterialized, profile });
  const ordered =
    preferred === null
      ? unmaterialized
      : [preferred, ...unmaterialized.filter((project) => project.id !== preferred.id)];

  if (session === null || ordered.length === 0) {
    return null;
  }

  const pick = async (projectId: ProjectId) => {
    setBusyProjectId(projectId);
    try {
      await materializeProject({ sessionId, projectId, reason: MANUAL_REASON });
      close();
    } catch (error) {
      void emitNotification('error', 'warning', 'could not add the project', formatError(error), {
        sessionId,
        workspaceId: session.workspaceId,
      });
    } finally {
      setBusyProjectId(null);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Add a project to this session"
        className={cn(
          'flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs transition-colors',
          open
            ? 'border-primary bg-primary/5 text-foreground'
            : 'border-border-soft text-muted-foreground hover:border-border hover:text-foreground',
        )}
      >
        <Plus size={11} aria-hidden />
        <span>project</span>
      </button>
      {open && (
        <Popover
          role="listbox"
          ariaLabel="Unmaterialized projects"
          className={cn(popupClassName, 'min-w-48 py-0.5')}
        >
          {ordered.map((project) => (
            <button
              key={project.id}
              type="button"
              disabled={busyProjectId !== null}
              onClick={() => void pick(project.id)}
              className={cn(
                'flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs transition-colors',
                'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                busyProjectId === project.id && 'opacity-50',
              )}
            >
              <FolderGit2 size={11} className="shrink-0" aria-hidden />
              <span className="flex-1 truncate">{project.name}</span>
              <span className="shrink-0 text-2xs text-muted-foreground/60">{project.kind}</span>
            </button>
          ))}
        </Popover>
      )}
    </div>
  );
};
