import type { Project } from '@goodboy/types';

type Orderable = Pick<Project, 'name' | 'starredAt' | 'lastAccessedAt'>;

export type StarredInside = 'name' | 'recency';

type Params<T extends Orderable> = {
  readonly projects: ReadonlyArray<T>;
  readonly inside: StarredInside;
};

const accessedAt = ({ project }: { readonly project: Orderable }): number =>
  project.lastAccessedAt === undefined ? 0 : Date.parse(project.lastAccessedAt);

const COMPARE = {
  name: (left: Orderable, right: Orderable): number => left.name.localeCompare(right.name),
  recency: (left: Orderable, right: Orderable): number =>
    accessedAt({ project: right }) - accessedAt({ project: left }) ||
    left.name.localeCompare(right.name),
} as const satisfies Record<StarredInside, (left: Orderable, right: Orderable) => number>;

export const starredProjectsFirst = <T extends Orderable>({
  projects,
  inside,
}: Params<T>): ReadonlyArray<T> => {
  const compare = COMPARE[inside];
  const starred = projects.filter((project) => project.starredAt !== undefined).sort(compare);
  const others = projects.filter((project) => project.starredAt === undefined).sort(compare);
  return [...starred, ...others];
};
