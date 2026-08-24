import { useShallow } from 'zustand/react/shallow';
import type { GitlabIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { RemoteHostKind } from '../../shared/lib/remoteHost';
import { useRootRemoteHostKind } from './useRootRemoteHostKind';

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

export const useWorkspaceRemoteHostKind = ({ workspaceId }: Params): RemoteHostKind | null => {
  const rootPath = useAppStore(
    (state) =>
      state.projects.find((project) => project.workspaceId === workspaceId)?.rootPath ?? null,
  );
  const isFolderProject = useAppStore(
    (state) =>
      state.projects.find((project) => project.workspaceId === workspaceId)?.kind === 'folder',
  );
  const gitlabHosts = useAppStore(
    useShallow((state) =>
      (workspaceId == null ? [] : (state.workspaceIntegrations[workspaceId] ?? []))
        .filter(
          (integration): integration is GitlabIntegrationBinding =>
            integration.provider === 'gitlab',
        )
        .map((integration) => integration.config.host),
    ),
  );
  return useRootRemoteHostKind({ rootPath, gitlabHosts, isEnabled: !isFolderProject });
};
