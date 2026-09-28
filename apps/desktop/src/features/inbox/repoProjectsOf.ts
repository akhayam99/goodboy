import type { Project, ProjectId } from '@goodboy/types';
import { classifyRemoteHost, projectPathFromRemoteUrl } from '../../shared/lib/remoteHost';
import type { InboxProvider } from './types';

export type RepoHost = 'github' | 'gitlab';

export type RepoProject = {
  readonly id: ProjectId;
  readonly path: string;
};

type HostParams = {
  readonly provider: InboxProvider;
};

type RecordRepoParams = {
  readonly host: RepoHost;
  readonly url: string;
};

type Params = {
  readonly host: RepoHost;
  readonly projects: ReadonlyArray<Project>;
  readonly gitlabHosts: ReadonlyArray<string>;
};

export const repoHostOf = ({ provider }: HostParams): RepoHost | null => {
  if (provider === 'github' || provider === 'gitlab') {
    return provider;
  }
  return null;
};

export const recordRepoPath = ({ host, url }: RecordRepoParams): string | null => {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const parts = pathname.split('/').filter((part) => part !== '');
  if (host === 'gitlab') {
    const dash = parts.indexOf('-');
    return dash > 0 ? parts.slice(0, dash).join('/').toLowerCase() : null;
  }
  const [owner, repo] = parts;
  return owner === undefined || repo === undefined ? null : `${owner}/${repo}`.toLowerCase();
};

export const repoProjectsOf = ({
  host,
  projects,
  gitlabHosts,
}: Params): ReadonlyArray<RepoProject> =>
  projects.flatMap((project) => {
    const remote = project.remoteUrl ?? null;
    if (classifyRemoteHost(remote, gitlabHosts) !== host) {
      return [];
    }
    const path = projectPathFromRemoteUrl(remote);
    return path === null ? [] : [{ id: project.id, path: path.toLowerCase() }];
  });
