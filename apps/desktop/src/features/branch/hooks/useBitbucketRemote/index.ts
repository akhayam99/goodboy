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
  readonly newPullRequestUrl: string | null;
};

const BITBUCKET_HOST = /^(?:[\w.-]+@|[a-z]+:\/\/(?:[^@/]+@)?)([^:/]+)/i;

const remoteCache = new Map<string, boolean>();

const isBitbucketUrl = ({ url }: { readonly url: string | null }): boolean =>
  url !== null && (BITBUCKET_HOST.exec(url.trim())?.[1] ?? '').toLowerCase().includes('bitbucket');

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
  const [isBitbucket, setIsBitbucket] = useState(() =>
    repoRoot === null ? false : (remoteCache.get(repoRoot) ?? false),
  );
  const hasResolved = useAppStore(
    (state) => state.sessionBitbucketPr[sessionId]?.fetchedAt != null,
  );
  const target = useAppStore((state) => {
    const mountId = selectActiveMountId({ state, sessionId });
    const entry = mountId === null ? undefined : state.mountBitbucketPr?.[mountId];
    return entry?.repo == null
      ? null
      : `https://bitbucket.org/${entry.repo.workspaceSlug}/${entry.repo.repoSlug}/pull-requests/new?source=${encodeURIComponent(entry.branch)}`;
  });

  useEffect(() => {
    if (repoRoot === null || !hasIntegration) {
      setIsBitbucket(false);
      return;
    }
    const cached = remoteCache.get(repoRoot);
    if (cached !== undefined) {
      setIsBitbucket(cached);
      return;
    }
    let isDisposed = false;
    void worktreeRemoteUrl(repoRoot)
      .then((url) => {
        const next = isBitbucketUrl({ url });
        remoteCache.set(repoRoot, next);
        if (!isDisposed) {
          setIsBitbucket(next);
        }
      })
      .catch(() => {
        if (!isDisposed) {
          setIsBitbucket(false);
        }
      });
    return () => {
      isDisposed = true;
    };
  }, [hasIntegration, repoRoot]);

  useEffect(() => {
    if (!isBitbucket || !hasIntegration || hasResolved) {
      return;
    }
    void refreshSessionBitbucketPr(sessionId, { silent: true });
  }, [hasIntegration, hasResolved, isBitbucket, refreshSessionBitbucketPr, sessionId]);

  return { isBitbucket, newPullRequestUrl: isBitbucket ? target : null };
};
