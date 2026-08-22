import { useEffect } from 'react';
import type { WorkspaceGitStatus, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

const POLL_INTERVAL_MS = 30_000;

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useWorkspaceGitStatus = ({ workspaceId }: Params): WorkspaceGitStatus | null => {
  const projectId = useAppStore(
    (state) =>
      state.projects.find(
        (project) => project.workspaceId === workspaceId && project.kind === 'repo',
      )?.id ?? null,
  );
  const status = useAppStore((state) =>
    projectId === null ? null : (state.projectGitStatus[projectId] ?? null),
  );
  const loadProjectGitStatus = useAppStore((state) => state.loadProjectGitStatus);

  useEffect(() => {
    if (projectId === null) {
      return;
    }
    const refresh = (): void => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void loadProjectGitStatus({ projectId });
    };
    void loadProjectGitStatus({ projectId });
    const intervalId = window.setInterval(refresh, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [projectId, loadProjectGitStatus]);

  if (projectId === null) {
    return null;
  }
  return status;
};
