import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { GitlabIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { classifyRemoteHost } from '../../../../shared/utils/remoteHost';
import { worktreeRemoteUrl } from '../../../worktree/worktree';

type Params = {
  readonly workspaceId: WorkspaceId;
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
  const [githubRoots, setGithubRoots] = useState<ReadonlyArray<string> | null>(null);

  useEffect(() => {
    let isDisposed = false;
    void Promise.all(roots.map((root) => isOnGithub({ root, gitlabHosts }))).then((flags) => {
      if (!isDisposed) {
        setGithubRoots(roots.filter((_, index) => flags[index] === true));
      }
    });
    return () => {
      isDisposed = true;
    };
  }, [gitlabHosts, roots]);

  return githubRoots;
};
