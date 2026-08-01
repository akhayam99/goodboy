import { useEffect, useState } from 'react';
import { classifyRemoteHost, type RemoteHostKind } from '../../shared/lib/remoteHost';
import { worktreeRemoteUrl } from './worktree';

const cache = new Map<string, RemoteHostKind>();

type Params = {
  readonly rootPath: string | null;
  readonly gitlabHosts: ReadonlyArray<string>;
  readonly isEnabled: boolean;
};

type ResolveParams = {
  readonly rootPath: string;
  readonly gitlabHosts: ReadonlyArray<string>;
};

const resolveRemoteHostKind = async ({
  rootPath,
  gitlabHosts,
}: ResolveParams): Promise<RemoteHostKind> => {
  const cached = cache.get(rootPath);
  if (cached != null) {
    return cached;
  }
  const url = await worktreeRemoteUrl(rootPath);
  const kind = classifyRemoteHost(url, gitlabHosts);
  cache.set(rootPath, kind);
  return kind;
};

export const useRootRemoteHostKind = ({
  rootPath,
  gitlabHosts,
  isEnabled,
}: Params): RemoteHostKind | null => {
  const [kind, setKind] = useState<RemoteHostKind | null>(() =>
    rootPath != null && isEnabled ? (cache.get(rootPath) ?? null) : null,
  );
  const hostsKey = gitlabHosts.join('|');

  useEffect(() => {
    if (rootPath == null || !isEnabled) {
      setKind(null);
      return;
    }
    let isDisposed = false;
    void resolveRemoteHostKind({ rootPath, gitlabHosts })
      .then((next) => {
        if (!isDisposed) {
          setKind(next);
        }
      })
      .catch(() => {
        if (!isDisposed) {
          setKind('other');
        }
      });
    return () => {
      isDisposed = true;
    };
  }, [gitlabHosts, hostsKey, isEnabled, rootPath]);

  return kind;
};
