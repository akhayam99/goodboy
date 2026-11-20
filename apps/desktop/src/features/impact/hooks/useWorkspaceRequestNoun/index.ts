import { useMemo } from 'react';
import type { PullRequestHost, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { requestHostOfRemote } from '../../../../store/slices/review-source/requestHostOfRemote';
import { requestNounOfHosts } from '../../utils/requestNounOfHosts';

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

export const useWorkspaceRequestNoun = ({ workspaceId }: Params): string => {
  const projects = useAppStore((state) => state.projects);
  const bindings = useAppStore((state) =>
    workspaceId === null ? undefined : state.workspaceIntegrations?.[workspaceId],
  );
  return useMemo(() => {
    const gitlabHosts = (bindings ?? []).flatMap((binding) =>
      binding.provider === 'gitlab' ? [binding.config.host] : [],
    );
    const hosts = projects.flatMap((project): ReadonlyArray<PullRequestHost> => {
      if (workspaceId === null || project.workspaceId !== workspaceId) {
        return [];
      }
      const host = requestHostOfRemote({ url: project.remoteUrl ?? null, gitlabHosts });
      return host === null ? [] : [host];
    });
    return requestNounOfHosts({ hosts });
  }, [bindings, projects, workspaceId]);
};
