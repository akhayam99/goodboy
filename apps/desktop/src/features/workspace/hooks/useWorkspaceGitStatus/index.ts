import { useEffect } from 'react';
import type { WorkspaceGitStatus, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

const POLL_INTERVAL_MS = 30_000;

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useWorkspaceGitStatus = ({ workspaceId }: Params): WorkspaceGitStatus | null => {
  const tracksGit = useAppStore((state) => {
    const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);
    return workspace != null && workspace.kind !== 'simple' && workspace.kind !== 'composite';
  });
  const status = useAppStore((state) => state.workspaceGitStatus?.[workspaceId] ?? null);
  const loadWorkspaceGitStatus = useAppStore((state) => state.loadWorkspaceGitStatus);

  useEffect(() => {
    if (!tracksGit) {
      return;
    }
    const refresh = (): void => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void loadWorkspaceGitStatus({ workspaceId });
    };
    void loadWorkspaceGitStatus({ workspaceId });
    const intervalId = window.setInterval(refresh, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [workspaceId, tracksGit, loadWorkspaceGitStatus]);

  if (!tracksGit) {
    return null;
  }
  return status;
};
