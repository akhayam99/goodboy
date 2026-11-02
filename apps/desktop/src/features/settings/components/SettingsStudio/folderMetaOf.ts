import type { Project, WorkspaceId } from '@goodboy/types';
import { pluralize } from '../../../../shared/utils/pluralize';

type Params = {
  readonly projects: ReadonlyArray<Pick<Project, 'workspaceId' | 'kind' | 'disconnectedAt'>>;
  readonly workspaceId: WorkspaceId;
};

export const folderMetaOf = ({ projects, workspaceId }: Params): string => {
  const linked = projects.filter(
    (project) => project.workspaceId === workspaceId && project.disconnectedAt === undefined,
  );
  if (linked.length === 0) {
    return 'No projects yet';
  }
  const withGit = linked.filter((project) => project.kind === 'repo').length;
  return `${pluralize(linked.length, 'project')} · ${withGit} with git`;
};
