import { useMemo } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { projectById } from '../../../../../store/slices/projects/projectIndex';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import type { ProjectCandidate } from '../../projectCandidate';

const ANOTHER_LINE = 'Not in this session. A worktree is created from main.';

type Params = {
  readonly sessionId: SessionId;
  readonly query: string;
};

type Candidates = Readonly<{
  inSession: ReadonlyArray<ProjectCandidate>;
  others: ReadonlyArray<ProjectCandidate>;
  workspaceId: WorkspaceId | null;
}>;

export const useProjectCandidates = ({ sessionId, query }: Params): Candidates => {
  const mounts = useAppStore((state) => state.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY);
  const projects = useAppStore((state) => state.projects);
  const workspaceId = useAppStore(
    (state) => sessionById(state.sessions, sessionId)?.workspaceId ?? null,
  );
  const inSession = useMemo(
    (): ReadonlyArray<ProjectCandidate> =>
      mounts.map((mount) => ({
        key: mount.mountId,
        name: projectById(projects, mount.projectId)?.name ?? mount.mountName,
        projectId: mount.projectId,
        line: mount.branch,
        isMounted: true,
      })),
    [mounts, projects],
  );
  const others = useMemo((): ReadonlyArray<ProjectCandidate> => {
    const mounted = new Set(mounts.map((mount) => mount.projectId));
    const needle = query.trim().toLowerCase();
    return projects
      .filter(
        (project) =>
          project.workspaceId === workspaceId &&
          !mounted.has(project.id) &&
          project.kind === 'repo',
      )
      .filter((project) => needle === '' || project.name.toLowerCase().includes(needle))
      .map((project) => ({
        key: project.id,
        name: project.name,
        projectId: project.id,
        line: ANOTHER_LINE,
        isMounted: false,
      }));
  }, [mounts, projects, query, workspaceId]);
  return { inSession, others, workspaceId };
};
