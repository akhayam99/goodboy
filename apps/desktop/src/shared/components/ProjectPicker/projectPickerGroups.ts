import type { Project, ProjectId } from '@goodboy/types';

type Groupable = Pick<Project, 'id' | 'name' | 'starredAt' | 'lastAccessedAt'>;

type Params<T extends Groupable> = {
  readonly projects: ReadonlyArray<T>;
  readonly suggestedIds: ReadonlyArray<ProjectId>;
};

type ProjectPickerGroups<T extends Groupable> = {
  readonly suggested: ReadonlyArray<T>;
  readonly all: ReadonlyArray<T>;
};

const SUGGESTED_PROJECTS_MAX = 5;

type AccessedAtParams = {
  readonly project: Groupable;
};

const accessedAt = ({ project }: AccessedAtParams): number =>
  project.lastAccessedAt === undefined ? 0 : Date.parse(project.lastAccessedAt);

export const projectPickerGroups = <T extends Groupable>({
  projects,
  suggestedIds,
}: Params<T>): ProjectPickerGroups<T> => {
  const named = suggestedIds.flatMap((id) => projects.filter((project) => project.id === id));
  const recent = projects
    .filter((project) => project.lastAccessedAt !== undefined)
    .sort((left, right) => accessedAt({ project: right }) - accessedAt({ project: left }));
  const starred = projects
    .filter((project) => project.starredAt !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name));
  const suggested = [...named, ...recent, ...starred]
    .filter((project, index, list) => list.findIndex((other) => other.id === project.id) === index)
    .slice(0, SUGGESTED_PROJECTS_MAX);
  const all = projects
    .filter((project) => !suggested.some((picked) => picked.id === project.id))
    .sort((left, right) => left.name.localeCompare(right.name));
  return { suggested, all };
};
