import { useShallow } from 'zustand/react/shallow';
import type { Project, WorkspaceGitStatus, WorkspaceId } from '@goodboy/types';
import { usePoll } from '../../../../shared/lib/usePoll';
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

  usePoll({
    run: () => {
      for (const projectId of projectIds) {
        void loadProjectGitStatus({ projectId });
      }
    },
    everyMs: POLL_INTERVAL_MS,
    isEnabled: projectIds.length > 0,
    restartKey: projectIdsKey,
  });

  return projects.map((project, index) => ({ project, status: statuses[index] ?? null }));
};
