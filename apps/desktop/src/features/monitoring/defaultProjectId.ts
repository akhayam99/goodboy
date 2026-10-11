import type { Project } from '@goodboy/types';

type Params = {
  readonly projects: ReadonlyArray<Project>;
};

export const defaultProjectId = ({ projects }: Params): string | null => {
  const live = projects.filter((project) => project.disconnectedAt === undefined);
  return (live.find((project) => project.starredAt !== undefined) ?? live[0])?.id ?? null;
};
