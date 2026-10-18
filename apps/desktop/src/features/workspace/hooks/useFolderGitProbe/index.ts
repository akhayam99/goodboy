import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly isIncludingLocalRepos: boolean;
};

export const useFolderGitProbe = ({ workspaceId, isIncludingLocalRepos }: Params): void => {
  const projectIds = useAppStore(
    useShallow((state) =>
      state.projects
        .filter(
          (project) =>
            project.workspaceId === workspaceId &&
            project.disconnectedAt == null &&
            (project.kind === 'folder' ||
              (isIncludingLocalRepos &&
                (project.remoteUrl === undefined || project.remoteUrl === ''))),
        )
        .map((project) => project.id),
    ),
  );
  const runningTurns = useAppStore(
    (state) => Object.values(state.agentTurnState).filter((turn) => turn.kind === 'running').length,
  );
  const probeFolderGit = useAppStore((state) => state.probeFolderGit);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    if (projectIds.length === 0) {
      return;
    }
    const probe = (): void => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      for (const projectId of projectIds) {
        void probeFolderGit({ projectId }).catch((error: unknown) =>
          reportError({
            title: "Couldn't check a folder for git",
            error,
            severity: 'warning',
            workspaceId,
            coalesceKey: `folder-git-probe:${projectId}`,
          }),
        );
      }
    };
    probe();
    window.addEventListener('focus', probe);
    document.addEventListener('visibilitychange', probe);
    return () => {
      window.removeEventListener('focus', probe);
      document.removeEventListener('visibilitychange', probe);
    };
  }, [probeFolderGit, projectIds, reportError, runningTurns, workspaceId]);
};
