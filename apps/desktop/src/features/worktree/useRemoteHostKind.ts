import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { GitlabWorkspaceIntegration, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { classifyRemoteHost, type RemoteHostKind } from '../../shared/lib/remoteHost';
import { worktreeRemoteUrl } from './worktree';

const cache = new Map<string, RemoteHostKind>();

export const useRemoteHostKind = (workspaceId: WorkspaceId | null): RemoteHostKind | null => {
  const rootPath = useAppStore(
    (s) => s.workspaces.find((w) => w.id === workspaceId)?.rootPath ?? null,
  );
  const isSimple = useAppStore(
    (s) => s.workspaces.find((w) => w.id === workspaceId)?.kind === 'simple',
  );
  const gitlabHosts = useAppStore(
    useShallow((s) =>
      (s.workspaceIntegrations[workspaceId as WorkspaceId] ?? [])
        .filter((i): i is GitlabWorkspaceIntegration => i.provider === 'gitlab')
        .map((i) => i.config.host),
    ),
  );
  const [kind, setKind] = useState<RemoteHostKind | null>(() =>
    rootPath && !isSimple ? (cache.get(rootPath) ?? null) : null,
  );

  const hostsKey = gitlabHosts.join('|');

  useEffect(() => {
    if (!rootPath || isSimple) {
      setKind(null);
      return;
    }
    const cached = cache.get(rootPath);
    if (cached) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath, hostsKey, isSimple]);

  return kind;
};
