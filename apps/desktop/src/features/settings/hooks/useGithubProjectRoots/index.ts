import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { GitlabIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { classifyRemoteHost } from '../../../../shared/utils/remoteHost';
import { worktreeRemoteUrl } from '../../../worktree/worktree';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type CheckedRoots = {
  readonly workspaceId: WorkspaceId;
  readonly roots: ReadonlyArray<string>;
  readonly gitlabHosts: ReadonlyArray<string>;
  readonly githubRoots: ReadonlyArray<string>;
};

type RootParams = {
  readonly root: string;
  readonly gitlabHosts: ReadonlyArray<string>;
};

const isOnGithub = async ({ root, gitlabHosts }: RootParams): Promise<boolean> => {
  try {
    return classifyRemoteHost(await worktreeRemoteUrl(root), gitlabHosts) === 'github';
  } catch {
    return false;
  }
};

export const useGithubProjectRoots = ({ workspaceId }: Params): ReadonlyArray<string> | null => {
  const roots = useAppStore(
    useShallow((s) =>
      s.projects
        .filter((project) => project.workspaceId === workspaceId && project.kind === 'repo')
        .map((project) => project.rootPath),
    ),
  );
  const gitlabHosts = useAppStore(
    useShallow((s) =>
      (s.workspaceIntegrations[workspaceId] ?? [])
        .filter((binding): binding is GitlabIntegrationBinding => binding.provider === 'gitlab')
        .map((binding) => binding.config.host),
    ),
  );
  const [checked, setChecked] = useState<CheckedRoots | null>(null);

  useEffect(() => {
    let isDisposed = false;
    void Promise.all(roots.map((root) => isOnGithub({ root, gitlabHosts }))).then((flags) => {
      if (!isDisposed) {
        setChecked({
          workspaceId,
          roots,
          gitlabHosts,
          githubRoots: roots.filter((_, index) => flags[index] === true),
        });
      }
    });
    return () => {
      isDisposed = true;
    };
  }, [gitlabHosts, roots, workspaceId]);

  const isCurrent =
    checked !== null &&
    checked.workspaceId === workspaceId &&
    checked.roots === roots &&
    checked.gitlabHosts === gitlabHosts;
  return isCurrent ? checked.githubRoots : null;
};
