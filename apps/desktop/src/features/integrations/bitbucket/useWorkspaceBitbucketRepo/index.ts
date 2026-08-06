import { useEffect, useMemo, useState } from 'react';
import type { BitbucketWorkspaceIntegration, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { worktreeRemoteUrl } from '../../../worktree/worktree';
import { projectPathFromRemoteUrl } from '../../../../shared/lib/remoteHost';
import { bitbucketRepoSlug } from '../../../../store/slices/bitbucket-pr/bitbucketRepoSlug';
import type { BitbucketRepo } from '../client';

const slugCache = new Map<string, string | null>();

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly isEnabled: boolean;
};

export const useWorkspaceBitbucketRepo = ({
  workspaceId,
  isEnabled,
}: Params): BitbucketRepo | null => {
  const rootPath = useAppStore((state) => {
    const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId) ?? null;
    if (workspace == null || (workspace.kind ?? 'repo') !== 'repo') {
      return null;
    }
    return workspace.rootPath;
  });
  const config = useAppStore((state) => {
    const integration = (state.workspaceIntegrations[workspaceId] ?? EMPTY_ARRAY).find(
      (candidate): candidate is BitbucketWorkspaceIntegration => candidate.provider === 'bitbucket',
    );
    return integration?.config ?? null;
  });
  const [repoSlug, setRepoSlug] = useState<string | null>(() =>
    rootPath == null ? null : (slugCache.get(rootPath) ?? null),
  );

  useEffect(() => {
    if (rootPath == null || !isEnabled) {
      setRepoSlug(null);
      return;
    }
    const cached = slugCache.get(rootPath);
    if (cached !== undefined) {
      setRepoSlug(cached);
      return;
    }
    let isDisposed = false;
    void worktreeRemoteUrl(rootPath)
      .then((remoteUrl) => {
        const slug = bitbucketRepoSlug({ projectPath: projectPathFromRemoteUrl(remoteUrl) });
        slugCache.set(rootPath, slug);
        if (!isDisposed) {
          setRepoSlug(slug);
        }
      })
      .catch(() => {
        if (!isDisposed) {
          setRepoSlug(null);
        }
      });
    return () => {
      isDisposed = true;
    };
  }, [isEnabled, rootPath]);

  return useMemo(() => {
    if (repoSlug == null || config == null) {
      return null;
    }
    return {
      workspaceId,
      workspaceSlug: config.workspaceSlug,
      repoSlug,
      email: config.email,
    };
  }, [config, repoSlug, workspaceId]);
};
