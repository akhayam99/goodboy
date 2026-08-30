import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Project, WorkspaceGitStatus, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

const POLL_INTERVAL_MS = 30_000;

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
  const projectIds = projects.map((project) => project.id);
  const projectIdsKey = projectIds.join('\u0000');

  useEffect(() => {
    if (projectIds.length === 0) {
      return;
    }
    const refresh = (): void => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      for (const projectId of projectIds) {
        void loadProjectGitStatus({ projectId });
      }
    };
    refresh();
    const intervalId = window.setInterval(refresh, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loadProjectGitStatus, projectIdsKey]);

  return projects.map((project, index) => ({ project, status: statuses[index] ?? null }));
};
