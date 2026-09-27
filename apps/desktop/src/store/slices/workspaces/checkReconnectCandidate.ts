import type { IsoDateTime, WorkspaceId } from '@goodboy/types';
import { describeProjectAdoption, findProjectByRootPath, getWorkspaceById } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn } from './types';

export type ReconnectCandidate = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly disconnectedAt: IsoDateTime;
  readonly sessionCount: number;
};

type Input = {
  readonly rootPath: string;
};

export const checkReconnectCandidate = (get: GetFn) => {
  return async ({ rootPath }: Input): Promise<ReconnectCandidate | null> => {
    const project = await findProjectByRootPath({ db: tauriDatabase, rootPath });
    if (project === null) {
      return null;
    }
    const workspace =
      get().workspaces.find((entry) => entry.id === project.workspaceId) ??
      (await getWorkspaceById({ db: tauriDatabase, id: project.workspaceId }));
    if (workspace === null || workspace === undefined || workspace.disconnectedAt === undefined) {
      return null;
    }
    const info = await describeProjectAdoption({ db: tauriDatabase, projectId: project.id });
    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      disconnectedAt: workspace.disconnectedAt,
      sessionCount: info?.sessionCount ?? 0,
    };
  };
};
