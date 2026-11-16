import type { Project, ProjectId } from '@goodboy/types';

type Groupable = Pick<Project, 'id' | 'name' | 'starredAt'>;

type Params<T extends Groupable> = {
  readonly projects: ReadonlyArray<T>;
  readonly recentIds: ReadonlyArray<ProjectId>;
};

type ProjectPickerGroups<T extends Groupable> = {
  readonly starred: ReadonlyArray<T>;
  readonly recent: ReadonlyArray<T>;
  readonly all: ReadonlyArray<T>;
};

const RECENT_PROJECTS_MAX = 5;

export const projectPickerGroups = <T extends Groupable>({
  projects,
  recentIds,
}: Params<T>): ProjectPickerGroups<T> => {
  const byName = [...projects].sort((left, right) => left.name.localeCompare(right.name));
  const starred = byName.filter((project) => project.starredAt !== undefined);
  const recent = recentIds
    .filter((id, index, list) => list.indexOf(id) === index)
    .flatMap((id) =>
      projects.filter((project) => project.id === id && project.starredAt === undefined),
    )
    .slice(0, RECENT_PROJECTS_MAX);
  const all = byName.filter(
    (project) =>
      project.starredAt === undefined && !recent.some((picked) => picked.id === project.id),
  );
  return { starred, recent, all };
};
