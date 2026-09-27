import type { Project, ProjectId, ProjectSentryLink } from '@goodboy/types';
import { classifyRemoteHost, projectPathFromRemoteUrl } from '../../shared/lib/remoteHost';
import type { InboxProvider, InboxRecord } from './types';

type RepoHost = 'github' | 'gitlab';

type Params = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly projects: ReadonlyArray<Project>;
  readonly links: ReadonlyArray<ProjectSentryLink>;
  readonly gitlabHosts?: ReadonlyArray<string>;
};

type SentryParams = {
  readonly slug: string;
  readonly links: ReadonlyArray<ProjectSentryLink>;
};

type HostParams = {
  readonly provider: InboxProvider;
};

type RecordRepoParams = {
  readonly host: RepoHost;
  readonly url: string;
};

type HostProjectsParams = {
  readonly host: RepoHost;
  readonly projects: ReadonlyArray<Project>;
  readonly gitlabHosts: ReadonlyArray<string>;
};

type RepoProject = {
  readonly id: ProjectId;
  readonly path: string;
};

const NO_HOSTS: ReadonlyArray<string> = [];

const sentryProjectsFor = ({ slug, links }: SentryParams): ReadonlyArray<ProjectId> => [
  ...new Set(links.filter((link) => link.sentryProject === slug).map((link) => link.projectId)),
];

const repoHostOf = ({ provider }: HostParams): RepoHost | null => {
  if (provider === 'github' || provider === 'gitlab') {
    return provider;
  }
  return null;
};

const recordRepoPath = ({ host, url }: RecordRepoParams): string | null => {
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

const hostProjectsOf = ({
  host,
  projects,
  gitlabHosts,
}: HostProjectsParams): ReadonlyArray<RepoProject> =>
  projects.flatMap((project) => {
    const remote = project.remoteUrl ?? null;
    if (classifyRemoteHost(remote, gitlabHosts) !== host) {
      return [];
    }
    const path = projectPathFromRemoteUrl(remote);
    return path === null ? [] : [{ id: project.id, path: path.toLowerCase() }];
  });

export const attachInboxProjects = ({
  records,
  projects,
  links,
  gitlabHosts = NO_HOSTS,
}: Params): ReadonlyArray<InboxRecord> => {
  const byHost: Readonly<Record<RepoHost, ReadonlyArray<RepoProject>>> = {
    github: hostProjectsOf({ host: 'github', projects, gitlabHosts }),
    gitlab: hostProjectsOf({ host: 'gitlab', projects, gitlabHosts }),
  };
  return records.map((record) => {
    const host = repoHostOf({ provider: record.provider });
    if (host !== null) {
      const candidates = byHost[host];
      if (candidates.length < 2) {
        return record;
      }
      const path = recordRepoPath({ host, url: record.url });
      const projectIds = candidates
        .filter((candidate) => candidate.path === path)
        .map((candidate) => candidate.id);
      return projectIds.length === 0 ? record : { ...record, projectIds };
    }
    if (record.payload.provider !== 'sentry') {
      return record;
    }
    const slug = record.payload.issue.project?.slug ?? null;
    const projectIds = slug === null ? [] : sentryProjectsFor({ slug, links });
    return projectIds.length === 0 ? record : { ...record, projectIds };
  });
};
