import type { ProjectId } from '@goodboy/types';
import { remoteHostNameOf } from '../../shared/lib/remoteHostNameOf';
import { recordRepoPath, type RepoHost, type RepoProject } from './repoProjectsOf';

type Params = {
  readonly host: RepoHost;
  readonly url: string;
  readonly repos: ReadonlyArray<RepoProject>;
};

export const recordRepoProjectIds = ({ host, url, repos }: Params): ReadonlyArray<ProjectId> => {
  const path = recordRepoPath({ host, url });
  const hostName = remoteHostNameOf({ url });
  if (path === null || hostName === null) {
    return [];
  }
  return repos
    .filter((repo) => repo.hostName === hostName && repo.path === path)
    .map((repo) => repo.id);
};
