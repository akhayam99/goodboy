import type { Project, WorkspaceId } from '@goodboy/types';
import { countNoun } from '../../../../shared/utils/countNoun';

type Params = {
  readonly projects: ReadonlyArray<Pick<Project, 'workspaceId' | 'kind' | 'disconnectedAt'>>;
  readonly workspaceId: WorkspaceId;
};

export const projectsCountLine = ({ projects, workspaceId }: Params): string => {
  const linked = projects.filter(
    (project) => project.workspaceId === workspaceId && project.disconnectedAt === undefined,
  );
  if (linked.length === 0) {
    return 'No projects yet';
  }
  const repoCount = linked.filter((project) => project.kind === 'repo').length;
  const folderCount = linked.filter((project) => project.kind === 'folder').length;
  const repos = countNoun({ count: repoCount, one: 'project' });
  if (folderCount === 0) {
    return repos;
  }
  return `${repos}, ${countNoun({ count: folderCount, one: 'plain folder' })}`;
};
