import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { GitlabWorkspaceIntegration, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { classifyRemoteHost, type RemoteHostKind } from '../../shared/lib/remoteHost';
import { worktreeRemoteUrl } from './worktree';

const cache = new Map<string, RemoteHostKind>();

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

export const useWorkspaceRemoteHostKind = ({ workspaceId }: Params): RemoteHostKind | null => {
  const rootPath = useAppStore(
    (state) => state.workspaces.find((workspace) => workspace.id === workspaceId)?.rootPath ?? null,
  );
  const isSimple = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.kind === 'simple',
  );
  const gitlabHosts = useAppStore(
    useShallow((state) =>
      (workspaceId == null ? [] : (state.workspaceIntegrations[workspaceId] ?? []))
        .filter(
          (integration): integration is GitlabWorkspaceIntegration =>
            integration.provider === 'gitlab',
        )
        .map((integration) => integration.config.host),
    ),
  );
  const [kind, setKind] = useState<RemoteHostKind | null>(() =>
    rootPath != null && !isSimple ? (cache.get(rootPath) ?? null) : null,
  );
  const hostsKey = gitlabHosts.join('|');

  useEffect(() => {
    if (rootPath == null || isSimple) {
      setKind(null);
      return;
    }
    const cached = cache.get(rootPath);
    if (cached != null) {
      setKind(cached);
      return;
    }
    let cancelled = false;
    worktreeRemoteUrl(rootPath)
      .then((url) => {
        const next = classifyRemoteHost(url, gitlabHosts);
        cache.set(rootPath, next);
        if (!cancelled) {
          setKind(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setKind('other');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [gitlabHosts, hostsKey, isSimple, rootPath]);

  return kind;
};
