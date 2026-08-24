import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AlertTriangle, Folder, FolderGit2 } from 'lucide-react';
import { Button, cn, Eyebrow, formatError } from '@goodboy/ui';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const NewSessionProjectPicker = ({ workspaceId }: Props) => {
  const isPending = useAppStore((state) => state.pendingProjectPickWorkspaceId === workspaceId);
  const projects = useAppStore(
    useShallow((state) =>
      (state.projects ?? []).filter((project) => project.workspaceId === workspaceId),
    ),
  );
  const createUntitledSession = useAppStore((state) => state.createUntitledSession);
  const clearSessionProjectPick = useAppStore((state) => state.clearSessionProjectPick);
  const [busyProjectId, setBusyProjectId] = useState<ProjectId | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isPending) {
    return null;
  }

  const start = async ({ projectId }: { readonly projectId: ProjectId }) => {
    setError(null);
    setBusyProjectId(projectId);
    try {
      await createUntitledSession({ workspaceId, projectId });
      clearSessionProjectPick();
    } catch (startError) {
      setError(formatError(startError));
    } finally {
      setBusyProjectId(null);
    }
  };

  return (
    <section
      aria-label="Pick the project for the new session"
      className="flex flex-col gap-2 rounded-lg border border-border bg-elevated/40 p-2"
    >
      <div className="flex items-center justify-between gap-2">
        <Eyebrow label="Which project?" />
        <button
          type="button"
          onClick={() => {
            setError(null);
            clearSessionProjectPick();
          }}
          className="rounded px-1.5 py-0.5 text-2xs text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <p className="text-2xs leading-relaxed text-muted-foreground">
        The session gets its own worktree inside the project you pick.
      </p>
      <div className="flex flex-col gap-1">
        {projects.map((project) => {
          const GlyphIcon = project.kind === 'repo' ? FolderGit2 : Folder;
          const isBusy = busyProjectId === project.id;
          return (
            <button
              key={project.id}
              type="button"
              disabled={busyProjectId !== null}
              onClick={() => void start({ projectId: project.id })}
              className={cn(
                'flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                'hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
                busyProjectId !== null && !isBusy && 'opacity-50',
              )}
            >
              <GlyphIcon size={13} aria-hidden className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                {project.name}
              </span>
              <span className="shrink-0 text-2xs text-muted-foreground/70">
                {isBusy ? 'Starting…' : project.kind}
              </span>
            </button>
          );
        })}
      </div>
      {error !== null && (
        <span
          role="alert"
          className="flex items-start gap-1.5 text-2xs leading-relaxed text-danger"
        >
          <AlertTriangle size={12} aria-hidden className="mt-0.5 shrink-0" />
          {error}
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="justify-start"
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent('goodboy:open-workspace-settings', { detail: { section: 'projects' } }),
          )
        }
      >
        Add another project
      </Button>
    </section>
  );
};
