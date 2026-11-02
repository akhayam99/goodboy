import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Project, WorkspaceGitStatus, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { watchProjectGitStatuses } from './watchProjectGitStatuses';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export type ProjectGitStatusEntry = {
  readonly project: Project;
  readonly status: WorkspaceGitStatus | null;
};

export const useProjectGitStatuses = ({
  workspaceId,
}: Params): ReadonlyArray<ProjectGitStatusEntry> => {
  const projects = useAppStore(
    useShallow((state) =>
      state.projects.filter(
        (project) => project.workspaceId === workspaceId && project.kind === 'repo',
      ),
    ),
  );
  const statuses = useAppStore(
    useShallow((state) => projects.map((project) => state.projectGitStatus[project.id] ?? null)),
  );
  const loadProjectGitStatus = useAppStore((state) => state.loadProjectGitStatus);
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects]);

  useEffect(() => {
    if (projectIds.length === 0) {
      return undefined;
    }
    return watchProjectGitStatuses({
      projectIds,
      load: ({ projectId }) => void loadProjectGitStatus({ projectId }),
    });
  }, [projectIds, loadProjectGitStatus]);

  return projects.map((project, index) => ({ project, status: statuses[index] ?? null }));
};
