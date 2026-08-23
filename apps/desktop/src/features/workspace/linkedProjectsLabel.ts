import type { Project, WorkspaceId } from '@goodboy/types';

type Params = {
  readonly projects: ReadonlyArray<Project> | undefined;
  readonly workspaceId: WorkspaceId | null;
};

export const linkedProjectCount = ({ projects, workspaceId }: Params): number =>
  workspaceId === null || projects === undefined
    ? 0
    : projects.filter(
        (project) => project.workspaceId === workspaceId && project.disconnectedAt === undefined,
      ).length;

export const linkedProjectsLabel = (params: Params): string => {
  const count = linkedProjectCount(params);
  return count === 1 ? '1 linked project' : `${count} linked projects`;
};
