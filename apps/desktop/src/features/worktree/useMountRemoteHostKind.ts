import { useShallow } from 'zustand/react/shallow';
import type { GitlabIntegrationBinding, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { RemoteHostKind } from '../../shared/lib/remoteHost';
import { useRootRemoteHostKind } from './useRootRemoteHostKind';
import { sessionById } from '../../store/slices/sessions/sessionIndex';

type Params = {
  readonly sessionId: SessionId;
  readonly repoRoot: string | null;
};

export const useMountRemoteHostKind = ({ sessionId, repoRoot }: Params): RemoteHostKind | null => {
  const workspaceId = useAppStore(
    (state) => sessionById(state.sessions, sessionId)?.workspaceId ?? null,
  );
  const gitlabHosts = useAppStore(
    useShallow((state) =>
      (workspaceId == null ? [] : (state.workspaceIntegrations[workspaceId] ?? []))
        .filter((binding): binding is GitlabIntegrationBinding => binding.provider === 'gitlab')
        .map((binding) => binding.config.host),
    ),
  );
  return useRootRemoteHostKind({
    rootPath: repoRoot === '' ? null : repoRoot,
    gitlabHosts,
    isEnabled: true,
  });
};
