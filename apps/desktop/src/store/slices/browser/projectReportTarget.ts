import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { projectById } from '../projects/projectIndex';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly projectId: ProjectId;
};

export const projectReportTarget = ({
  get,
  projectId,
}: Params): { readonly workspaceId?: WorkspaceId } => {
  const workspaceId = projectById(get().projects, projectId)?.workspaceId;
  return workspaceId === undefined ? {} : { workspaceId };
};
