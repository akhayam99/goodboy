import { FolderTree } from 'lucide-react';
import type { SessionId, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { ProjectSwitcher } from '../../ProjectSwitcher';

const EMPTY_MOUNTS: ReadonlyArray<SessionProjectMount> = [];

type Props = {
  readonly sessionId: SessionId;
};

export const ScopeBar = ({ sessionId }: Props) => {
  const mounts = useAppStore((state) => state.sessionProjectMounts[sessionId] ?? EMPTY_MOUNTS);
  const workspaceProjectCount = useAppStore((state) => {
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    if (session === undefined) {
      return 0;
    }
    return state.projects.filter((project) => project.workspaceId === session.workspaceId).length;
  });

  if (mounts.length <= 1 && workspaceProjectCount <= 1) {
    return null;
  }

  return (
    <div
      data-testid="repo-scope-bar"
      aria-label="Project scope"
      className="flex h-9 min-w-0 shrink-0 items-center gap-2 border-b border-border-soft bg-background px-4"
    >
      <FolderTree size={12} aria-hidden className="shrink-0 text-muted-foreground/60" />
      <span className="shrink-0 text-2xs text-muted-foreground">Scoped to</span>
      <ProjectSwitcher sessionId={sessionId} />
    </div>
  );
};
