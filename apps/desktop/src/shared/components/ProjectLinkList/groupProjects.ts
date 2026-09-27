import type { Project } from '@goodboy/types';

export type ProjectGroups = {
  readonly starred: ReadonlyArray<Project>;
  readonly all: ReadonlyArray<Project>;
};

const byName = (a: Project, b: Project): number => a.name.localeCompare(b.name);

export const groupProjects = (projects: ReadonlyArray<Project>): ProjectGroups => {
  const starred: Project[] = [];
  const all: Project[] = [];
  for (const project of projects) {
    if (project.starredAt !== undefined) {
      starred.push(project);
      continue;
    }
    all.push(project);
  }
  return { starred: starred.sort(byName), all: all.sort(byName) };
};
