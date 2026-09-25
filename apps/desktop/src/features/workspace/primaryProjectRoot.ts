import type { Project, WorkspaceId } from '@goodboy/types';
import { starredProjectsFirst } from '../../shared/utils/starredProjectsFirst';

type Params = {
  readonly projects: ReadonlyArray<Project> | undefined;
  readonly workspaceId: WorkspaceId;
};

export const primaryProjectRoot = ({ projects, workspaceId }: Params): string | null => {
  const owned = starredProjectsFirst({
    projects: (projects ?? []).filter((project) => project.workspaceId === workspaceId),
  });
  const repo = owned.find((project) => project.kind === 'repo');
  return repo?.rootPath ?? owned[0]?.rootPath ?? null;
};
