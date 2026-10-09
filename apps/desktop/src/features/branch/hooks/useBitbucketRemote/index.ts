import { useEffect, useState } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectActiveMountId } from '../../../../store/slices/project-mounts/selectors';
import { worktreeRemoteUrl } from '../../../worktree/worktree';

type Params = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly repoRoot: string | null;
};

export type BitbucketRemote = {
  readonly isBitbucket: boolean;
  readonly isConnected: boolean;
  readonly newPullRequestUrl: string | null;
};

const BITBUCKET_HOST = /^(?:[\w.-]+@|[a-z]+:\/\/(?:[^@/]+@)?)([^:/]+)/i;

const BITBUCKET_PATH = /bitbucket[^:/]*[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/i;

type Remote = {
  readonly isBitbucket: boolean;
  readonly path: string | null;
};

const NOT_BITBUCKET: Remote = { isBitbucket: false, path: null };

const remoteCache = new Map<string, Remote>();

const remoteOf = ({ url }: { readonly url: string | null }): Remote => {
  if (
    url === null ||
    !(BITBUCKET_HOST.exec(url.trim())?.[1] ?? '').toLowerCase().includes('bitbucket')
  ) {
    return NOT_BITBUCKET;
  }
  return { isBitbucket: true, path: BITBUCKET_PATH.exec(url.trim())?.[1] ?? null };
};

export const useBitbucketRemote = ({
  sessionId,
  workspaceId,
  repoRoot,
}: Params): BitbucketRemote => {
  const hasIntegration = useAppStore((state) =>
    (state.workspaceIntegrations[workspaceId] ?? []).some(
      (integration) => integration.provider === 'bitbucket',
    ),
  );
  const refreshSessionBitbucketPr = useAppStore((state) => state.refreshSessionBitbucketPr);
  const [remote, setRemote] = useState<Remote>(() =>
    repoRoot === null ? NOT_BITBUCKET : (remoteCache.get(repoRoot) ?? NOT_BITBUCKET),
  );
  const isBitbucket = remote.isBitbucket;
  const hasResolved = useAppStore(
    (state) => state.sessionBitbucketPr[sessionId]?.fetchedAt != null,
  );
  const remotePath = remote.path;
  const target = useAppStore((state) => {
    const mountId = selectActiveMountId({ state, sessionId });
    const entry = mountId === null ? undefined : state.mountBitbucketPr?.[mountId];
    if (entry?.repo != null) {
      return `https://bitbucket.org/${entry.repo.workspaceSlug}/${entry.repo.repoSlug}/pull-requests/new?source=${encodeURIComponent(entry.branch)}`;
    }
    const branch = (state.sessionMounts?.[sessionId] ?? []).find(
      (mount) => mount.id === mountId,
    )?.branch;
    return remotePath === null || branch == null
      ? null
      : `https://bitbucket.org/${remotePath}/pull-requests/new?source=${encodeURIComponent(branch)}`;
  });

  useEffect(() => {
    if (repoRoot === null) {
      setRemote(NOT_BITBUCKET);
      return;
    }
    const cached = remoteCache.get(repoRoot);
    if (cached !== undefined) {
      setRemote(cached);
      return;
    }
    let isDisposed = false;
    void worktreeRemoteUrl(repoRoot)
      .then((url) => {
        const next = remoteOf({ url });
        remoteCache.set(repoRoot, next);
        if (!isDisposed) {
          setRemote(next);
        }
      })
      .catch(() => {
        if (!isDisposed) {
          setRemote(NOT_BITBUCKET);
        }
      });
    return () => {
      isDisposed = true;
    };
  }, [repoRoot]);

  useEffect(() => {
    if (!isBitbucket || !hasIntegration || hasResolved) {
      return;
    }
    void refreshSessionBitbucketPr(sessionId, { silent: true });
  }, [hasIntegration, hasResolved, isBitbucket, refreshSessionBitbucketPr, sessionId]);

  return {
    isBitbucket,
    isConnected: hasIntegration,
    newPullRequestUrl: isBitbucket ? target : null,
  };
};
