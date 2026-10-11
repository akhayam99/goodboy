import type { Project } from '@goodboy/types';
import { starredProjectsFirst } from '../../utils/starredProjectsFirst';

export type ProjectGroups = {
  readonly starred: ReadonlyArray<Project>;
  readonly all: ReadonlyArray<Project>;
};

export const groupProjects = (projects: ReadonlyArray<Project>): ProjectGroups => {
  const ordered = starredProjectsFirst({ projects, inside: 'name' });
  return {
    starred: ordered.filter((project) => project.starredAt !== undefined),
    all: ordered.filter((project) => project.starredAt === undefined),
  };
};
