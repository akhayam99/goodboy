import type { MountId, PullRequestHost, WorkspaceId } from '@goodboy/types';
import type { AppState } from '../../types';
import { projectById } from '../projects/projectIndex';
import type { MountTarget } from '../project-mounts/mountRequests';
import { requestHostOfRemote } from './requestHostOfRemote';

export type MountHostState = Pick<
  AppState,
  'projects' | 'workspaceIntegrations' | 'mountGitlabMr' | 'mountBitbucketPr'
>;

type Params = {
  readonly state: MountHostState;
  readonly workspaceId: WorkspaceId;
  readonly mount: Pick<MountTarget, 'id' | 'projectId'>;
};

type EntryParams = {
  readonly state: MountHostState;
  readonly mountId: MountId;
};

const entryHostOf = ({ state, mountId }: EntryParams): PullRequestHost | null => {
  if (state.mountGitlabMr?.[mountId] !== undefined) {
    return 'gitlab';
  }
  if (state.mountBitbucketPr?.[mountId] !== undefined) {
    return 'bitbucket';
  }
  return null;
};

export const mountRequestHostOf = ({ state, workspaceId, mount }: Params): PullRequestHost => {
  const gitlabHosts = (state.workspaceIntegrations?.[workspaceId] ?? []).flatMap((binding) =>
    binding.provider === 'gitlab' ? [binding.config.host] : [],
  );
  return (
    entryHostOf({ state, mountId: mount.id }) ??
    requestHostOfRemote({
      url: projectById(state.projects, mount.projectId)?.remoteUrl ?? null,
      gitlabHosts,
    }) ??
    'github'
  );
};
