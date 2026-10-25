import type { Project, ProjectId, WorkspaceId } from '@goodboy/types';
import { projectPathFromRemoteUrl } from '../../../../../shared/utils/remoteHost';

type Params = {
  readonly projects: ReadonlyArray<Project>;
  readonly workspaceId: WorkspaceId;
  readonly projectPath: string;
};

export const projectIdOfGitlabPath = ({
  projects,
  workspaceId,
  projectPath,
}: Params): ProjectId | undefined => {
  const wanted = projectPath.toLowerCase();
  for (const project of projects) {
    if (
      project.workspaceId === workspaceId &&
      projectPathFromRemoteUrl(project.remoteUrl ?? null)?.toLowerCase() === wanted
    ) {
      return project.id;
    }
  }
  return undefined;
};
