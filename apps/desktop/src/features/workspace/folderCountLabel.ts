import type { Project, WorkspaceId } from '@goodboy/types';
import { pluralize } from '../../shared/utils/pluralize';

type Params = {
  readonly projects: ReadonlyArray<Project> | undefined;
  readonly workspaceId: WorkspaceId | null;
};

const folderCount = ({ projects, workspaceId }: Params): number =>
  workspaceId === null || projects === undefined
    ? 0
    : projects.filter(
        (project) => project.workspaceId === workspaceId && project.disconnectedAt === undefined,
      ).length;

export const folderCountLabel = (params: Params): string =>
  pluralize(folderCount(params), 'folder');
