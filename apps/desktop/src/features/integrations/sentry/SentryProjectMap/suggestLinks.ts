import type { Project, ProjectId, ProjectSentryLink } from '@goodboy/types';
import type { SentryCodeMapping } from '../client';

export type SentryLinkSuggestion = {
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly sentryProject: string;
  readonly repoName: string;
};

type Params = {
  readonly projects: ReadonlyArray<Project>;
  readonly mappings: ReadonlyArray<SentryCodeMapping>;
  readonly links: ReadonlyArray<ProjectSentryLink>;
};

const lastSegment = (value: string): string => {
  const parts = value.split('/').filter((part) => part !== '');
  return (parts[parts.length - 1] ?? '').toLowerCase();
};

const projectKeys = (project: Project): ReadonlyArray<string> =>
  [project.name.toLowerCase(), lastSegment(project.rootPath)].filter((key) => key !== '');

export const suggestLinks = ({
  projects,
  mappings,
  links,
}: Params): ReadonlyArray<SentryLinkSuggestion> => {
  const linked = new Set(links.map((link) => `${link.projectId}:${link.sentryProject}`));
  const seen = new Set<string>();
  const suggestions: SentryLinkSuggestion[] = [];
  for (const mapping of mappings) {
    if (mapping.projectSlug == null || mapping.repoName == null) {
      continue;
    }
    const repo = lastSegment(mapping.repoName);
    for (const project of projects) {
      const key = `${project.id}:${mapping.projectSlug}`;
      if (!projectKeys(project).includes(repo) || linked.has(key) || seen.has(key)) {
        continue;
      }
      seen.add(key);
      suggestions.push({
        projectId: project.id,
        projectName: project.name,
        sentryProject: mapping.projectSlug,
        repoName: mapping.repoName,
      });
    }
  }
  return suggestions;
};
