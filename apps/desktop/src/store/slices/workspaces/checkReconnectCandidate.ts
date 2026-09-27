import type { IsoDateTime, Project, ProjectId, WorkspaceId } from '@goodboy/types';
import {
  describeProjectAdoption,
  findDisconnectedProjectByIdentity,
  findProjectByRootPath,
  getWorkspaceById,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { repoIdentity } from '../../../shared/lib/repo';
import type { GetFn } from './types';

export type ReconnectCandidate = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly disconnectedAt: IsoDateTime;
  readonly sessionCount: number;
  readonly moved: { readonly projectId: ProjectId; readonly fromRoot: string } | null;
};

type Input = {
  readonly rootPath: string;
};

const toCandidate = async ({
  get,
  project,
  moved,
}: {
  readonly get: GetFn;
  readonly project: Project;
  readonly moved: boolean;
}): Promise<ReconnectCandidate | null> => {
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
    moved: moved ? { projectId: project.id, fromRoot: project.rootPath } : null,
  };
};

export const checkReconnectCandidate = (get: GetFn) => {
  return async ({ rootPath }: Input): Promise<ReconnectCandidate | null> => {
    const exact = await findProjectByRootPath({ db: tauriDatabase, rootPath });
    if (exact !== null) {
      return toCandidate({ get, project: exact, moved: false });
    }
    const identity = await repoIdentity({ path: rootPath }).catch(() => null);
    if (identity === null || (identity.rootCommits.length === 0 && identity.remoteUrl === null)) {
      return null;
    }
    const moved = await findDisconnectedProjectByIdentity({
      db: tauriDatabase,
      rootCommit: identity.rootCommits[0] ?? null,
      remoteUrl: identity.remoteUrl,
    });
    if (moved === null) {
      return null;
    }
    return toCandidate({ get, project: moved, moved: true });
  };
};
