import type { Project } from '@goodboy/types';

type Params<T extends Pick<Project, 'starredAt' | 'lastAccessedAt'>> = {
  readonly projects: ReadonlyArray<T>;
};

const accessedAt = ({ project }: { readonly project: Pick<Project, 'lastAccessedAt'> }): number =>
  project.lastAccessedAt === undefined ? 0 : Date.parse(project.lastAccessedAt);

export const starredProjectsFirst = <T extends Pick<Project, 'starredAt' | 'lastAccessedAt'>>({
  projects,
}: Params<T>): ReadonlyArray<T> => {
  const starred = projects
    .filter((project) => project.starredAt !== undefined)
    .sort((left, right) => accessedAt({ project: right }) - accessedAt({ project: left }));
  const others = projects.filter((project) => project.starredAt === undefined);
  return [...starred, ...others];
};
