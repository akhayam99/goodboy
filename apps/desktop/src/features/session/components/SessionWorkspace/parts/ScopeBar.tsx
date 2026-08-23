import { FolderTree } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { ProjectScopeChip } from './ProjectScopeChip';

const EMPTY_MOUNTS: ReadonlyArray<SessionProjectMount> = [];

type Props = {
  readonly sessionId: SessionId;
};

export const ScopeBar = ({ sessionId }: Props) => {
  const mounts = useAppStore((state) => state.sessionProjectMounts[sessionId] ?? EMPTY_MOUNTS);
  const activeProjectId = useAppStore((state) => state.sessionActiveProject[sessionId] ?? null);
  const projects = useAppStore(
    useShallow((state) => {
      const session = state.sessions.find((candidate) => candidate.id === sessionId);
      if (session === undefined) {
        return [];
      }
      return state.projects.filter((project) => project.workspaceId === session.workspaceId);
    }),
  );

  if (projects.length === 0) {
    return null;
  }

  const activeMountedId =
    mounts.find((mount) => mount.projectId === activeProjectId)?.projectId ??
    mounts[0]?.projectId ??
    null;

  return (
    <div
      data-testid="repo-scope-bar"
      aria-label="Project scope"
      className="flex h-9 min-w-0 shrink-0 items-center gap-2 border-b border-border-soft bg-background px-4"
    >
      <FolderTree size={12} aria-hidden className="shrink-0 text-muted-foreground/60" />
      <span className="shrink-0 text-2xs text-muted-foreground">Scoped to</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {projects.map((project) => (
          <ProjectScopeChip
            key={project.id}
            sessionId={sessionId}
            project={project}
            mount={mounts.find((mount) => mount.projectId === project.id) ?? null}
            isActive={project.id === activeMountedId}
            canSwitch={mounts.length > 1}
          />
        ))}
      </div>
    </div>
  );
};
