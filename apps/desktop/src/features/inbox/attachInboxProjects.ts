import type { Project, ProjectId, ProjectSentryLink } from '@goodboy/types';
import { recordRepoProjectIds } from './recordRepoProjectIds';
import { repoHostOf, repoProjectsOf, type RepoHost, type RepoProject } from './repoProjectsOf';
import type { InboxRecord } from './types';

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

const NO_HOSTS: ReadonlyArray<string> = [];

export const sentryLinkedProjects = ({ slug, links }: SentryParams): ReadonlyArray<ProjectId> => [
  ...new Set(links.filter((link) => link.sentryProject === slug).map((link) => link.projectId)),
];

export const attachInboxProjects = ({
  records,
  projects,
  links,
  gitlabHosts = NO_HOSTS,
}: Params): ReadonlyArray<InboxRecord> => {
  const byHost: Readonly<Record<RepoHost, ReadonlyArray<RepoProject>>> = {
    github: repoProjectsOf({ host: 'github', projects, gitlabHosts }),
    gitlab: repoProjectsOf({ host: 'gitlab', projects, gitlabHosts }),
  };
  return records.map((record) => {
    const host = repoHostOf({ provider: record.provider });
    if (host !== null) {
      const projectIds = recordRepoProjectIds({ host, url: record.url, repos: byHost[host] });
      return projectIds.length === 0 ? record : { ...record, projectIds };
    }
    if (record.payload.provider !== 'sentry') {
      return record;
    }
    const slug = record.payload.issue.project?.slug ?? null;
    const projectIds = slug === null ? [] : sentryLinkedProjects({ slug, links });
    return projectIds.length === 0 ? record : { ...record, projectIds };
  });
};
