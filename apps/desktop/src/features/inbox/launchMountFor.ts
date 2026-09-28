import type { Project, ProjectId, ProjectSentryLink } from '@goodboy/types';
import type { SentryCodeMapping } from '../integrations/sentry/client';
import { suggestLinks } from '../integrations/sentry/SentryProjectMap/suggestLinks';
import { sentryLinkedProjects } from './attachInboxProjects';
import { recordRepoPath, repoHostOf, repoProjectsOf } from './repoProjectsOf';
import type { InboxProvider } from './types';

export type LaunchMountOption = {
  readonly projectId: ProjectId;
  readonly name: string;
};

export type LaunchMountSource = {
  readonly provider: InboxProvider;
  readonly url: string;
  readonly sentryProject: string | null;
};

export type LaunchMount = {
  readonly options: ReadonlyArray<LaunchMountOption>;
  readonly selectedId: ProjectId;
  readonly reason: string;
};

type Params = {
  readonly source: LaunchMountSource;
  readonly projects: ReadonlyArray<Project>;
  readonly links: ReadonlyArray<ProjectSentryLink>;
  readonly mappings: ReadonlyArray<SentryCodeMapping>;
  readonly gitlabHosts: ReadonlyArray<string>;
};

type RankedParams = {
  readonly ids: ReadonlyArray<ProjectId>;
  readonly projects: ReadonlyArray<Project>;
  readonly reason: string;
  readonly scoreOf: (project: Project) => number;
};

const HOST_LABEL = { github: 'GitHub', gitlab: 'GitLab' } as const;

const rankedMount = ({ ids, projects, reason, scoreOf }: RankedParams): LaunchMount | null => {
  const ranked = projects
    .filter((project) => ids.includes(project.id))
    .map((project, index) => ({ project, index, score: scoreOf(project) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ project }) => ({ projectId: project.id, name: project.name }));
  const [first] = ranked;
  return first === undefined ? null : { options: ranked, selectedId: first.projectId, reason };
};

export const launchMountFor = ({
  source,
  projects,
  links,
  mappings,
  gitlabHosts,
}: Params): LaunchMount | null => {
  const host = repoHostOf({ provider: source.provider });
  if (host !== null) {
    const path = recordRepoPath({ host, url: source.url });
    if (path === null) {
      return null;
    }
    const ids = repoProjectsOf({ host, projects, gitlabHosts })
      .filter((candidate) => candidate.path === path)
      .map((candidate) => candidate.id);
    return rankedMount({
      ids,
      projects,
      reason: `from ${HOST_LABEL[host]} repo ${path}`,
      scoreOf: () => 0,
    });
  }
  const slug = source.provider === 'sentry' ? source.sentryProject : null;
  if (slug === null) {
    return null;
  }
  const linked = sentryLinkedProjects({ slug, links });
  const mapped = suggestLinks({ projects, mappings, links: [] })
    .filter((suggestion) => suggestion.sentryProject === slug)
    .map((suggestion) => suggestion.projectId);
  return rankedMount({
    ids: [...new Set([...linked, ...mapped])],
    projects,
    reason: `from Sentry project ${slug}`,
    scoreOf: (project) =>
      (linked.includes(project.id) ? 2 : 0) +
      (mapped.includes(project.id) ? 2 : 0) +
      (project.name.toLowerCase() === slug.toLowerCase() ? 1 : 0),
  });
};
