import { useCallback, useEffect } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

export const useGithubConnection = ({ workspaceId }: Params) => {
  const stored = useAppStore((s) =>
    workspaceId === null ? null : s.githubWorkspaceStatus[workspaceId],
  );
  const refreshGithubConnection = useAppStore((s) => s.refreshGithubConnection);
  const isResolved = stored !== undefined;

  useEffect(() => {
    if (workspaceId === null || isResolved) {
      return;
    }
    void refreshGithubConnection({ workspaceId });
  }, [workspaceId, isResolved, refreshGithubConnection]);

  const refresh = useCallback(() => {
    void refreshGithubConnection({ workspaceId });
  }, [refreshGithubConnection, workspaceId]);

  const status = stored ?? null;
  return {
    status,
    user: status?.user ?? null,
    mode: status?.mode ?? 'absent',
    isAuthenticated: status !== null && status.mode !== 'absent',
    isResolved,
    isScoped: status?.scoped === true,
    refresh,
  };
};

export type GithubConnection = ReturnType<typeof useGithubConnection>;
