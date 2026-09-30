import { useShallow } from 'zustand/react/shallow';
import type { GitlabIntegrationBinding, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { useSessionRepo } from '../../store/slices/worktrees/useSessionRepo';
import type { RemoteHostKind } from '../../shared/lib/remoteHost';
import { useRootRemoteHostKind } from './useRootRemoteHostKind';
import { sessionById } from '../../store/slices/sessions/sessionIndex';

type Params = {
  readonly sessionId: SessionId;
};

export const useRemoteHostKind = ({ sessionId }: Params): RemoteHostKind | null => {
  const repo = useSessionRepo({ sessionId });
  const rootPath = repo?.repoRoot ?? null;
  const workspaceId = useAppStore(
    (state) => sessionById(state.sessions, sessionId)?.workspaceId ?? null,
  );
  const gitlabHosts = useAppStore(
    useShallow((s) =>
      (workspaceId == null ? [] : (s.workspaceIntegrations[workspaceId] ?? []))
        .filter((i): i is GitlabIntegrationBinding => i.provider === 'gitlab')
        .map((i) => i.config.host),
    ),
  );
  return useRootRemoteHostKind({ rootPath, gitlabHosts, isEnabled: true });
};
