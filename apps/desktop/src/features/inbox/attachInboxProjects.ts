import type { Project, ProjectId, ProjectSentryLink } from '@goodboy/types';
import type { InboxProvider, InboxRecord } from './types';

const CODE_HOSTS: ReadonlyArray<InboxProvider> = ['github', 'gitlab', 'bitbucket'];

type Params = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly projects: ReadonlyArray<Project>;
  readonly rootPath: string;
  readonly links: ReadonlyArray<ProjectSentryLink>;
};

const sentryProjectsFor = ({
  slug,
  links,
}: {
  readonly slug: string;
  readonly links: ReadonlyArray<ProjectSentryLink>;
}): ReadonlyArray<ProjectId> => [
  ...new Set(links.filter((link) => link.sentryProject === slug).map((link) => link.projectId)),
];

export const attachInboxProjects = ({
  records,
  projects,
  rootPath,
  links,
}: Params): ReadonlyArray<InboxRecord> => {
  const rootProject = projects.find((project) => project.rootPath === rootPath) ?? null;
  return records.map((record) => {
    if (CODE_HOSTS.includes(record.provider)) {
      return rootProject === null ? record : { ...record, projectIds: [rootProject.id] };
    }
    if (record.payload.provider !== 'sentry') {
      return record;
    }
    const slug = record.payload.issue.project?.slug ?? null;
    const projectIds = slug === null ? [] : sentryProjectsFor({ slug, links });
    return projectIds.length === 0 ? record : { ...record, projectIds };
  });
};
