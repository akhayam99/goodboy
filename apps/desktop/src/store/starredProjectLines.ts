import type { Project } from '@goodboy/types';
import { starredProjectsFirst } from '../shared/utils/starredProjectsFirst';

const STARRED_FIRST_RULE = 'When a request names no project, look in starred projects first.';

type LineParams = {
  readonly project: Project;
  readonly focus: string;
};

type Params = {
  readonly projects: ReadonlyArray<Project>;
  readonly line: (params: LineParams) => string;
};

const focusOf = ({ project }: { readonly project: Project }): string => {
  const description = project.description?.trim() ?? '';
  const parts = [
    ...(project.starredAt === undefined ? [] : ['starred, the owner works here most']),
    ...(description === '' ? [] : [description]),
  ];
  return parts.length === 0 ? '' : ` | ${parts.join(' | ')}`;
};

export const starredProjectLines = ({ projects, line }: Params): ReadonlyArray<string> => {
  const hasStarred = projects.some((project) => project.starredAt !== undefined);
  return [
    ...starredProjectsFirst({ projects }).map((project) =>
      line({ project, focus: focusOf({ project }) }),
    ),
    ...(hasStarred ? [STARRED_FIRST_RULE] : []),
  ];
};
