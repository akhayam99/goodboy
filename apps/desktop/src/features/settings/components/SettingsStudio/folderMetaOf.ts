import type { Project, WorkspaceId } from '@goodboy/types';
import { pluralize } from '../../../../shared/utils/pluralize';

type Params = {
  readonly projects: ReadonlyArray<Pick<Project, 'workspaceId' | 'kind' | 'disconnectedAt'>>;
  readonly workspaceId: WorkspaceId;
};

export const folderMetaOf = ({ projects, workspaceId }: Params): string => {
  const folders = projects.filter(
    (project) => project.workspaceId === workspaceId && project.disconnectedAt === undefined,
  );
  if (folders.length === 0) {
    return 'No folders yet';
  }
  const withGit = folders.filter((project) => project.kind === 'repo').length;
  return `${pluralize(folders.length, 'folder')} · ${withGit} with git`;
};
