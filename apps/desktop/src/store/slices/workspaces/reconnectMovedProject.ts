import type { IsoDateTime, ProjectId, Workspace, WorkspaceId } from '@goodboy/types';
import {
  getWorkspaceById,
  listAllProjectsForWorkspace,
  reconnectWorkspaceAndProjects,
  updateProjectIdentity,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { projectRelocate } from '../../../features/workspace/projectRelocation';
import { repoIdentity } from '../../../shared/lib/repo';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId;
  readonly fromRoot: string;
  readonly toRoot: string;
};

export const reconnectMovedProject = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, projectId, fromRoot, toRoot }: Input): Promise<Workspace> => {
    const now = new Date().toISOString() as IsoDateTime;
    const siblingProjects = await listAllProjectsForWorkspace({ db: tauriDatabase, workspaceId });
    await reconnectWorkspaceAndProjects({
      db: tauriDatabase,
      id: workspaceId,
      projectIds: siblingProjects.map((project) => project.id),
      at: now,
    });
    const relocationId = crypto.randomUUID();
    await projectRelocate({ relocationId, projectId, fromRoot, toRoot });
    const identity = await repoIdentity({ path: toRoot }).catch(() => null);
    const rootCommit = identity?.rootCommits[0] ?? null;
    const remoteUrl = identity?.remoteUrl ?? null;
    await updateProjectIdentity({
      db: tauriDatabase,
      projectId,
      rootCommit,
      remoteUrl,
      checkedAt: now,
    });
    const workspace = await getWorkspaceById({ db: tauriDatabase, id: workspaceId });
    if (workspace === null) {
      throw new Error('workspace no longer exists');
    }
    const reconnectedWorkspace: Workspace = {
      ...workspace,
      disconnectedAt: undefined,
      updatedAt: now,
      lastAccessedAt: now,
    };
    const reconnectedProjects = siblingProjects.map((project) => ({
      ...project,
      ...(project.id !== projectId
        ? {}
        : {
            rootPath: toRoot,
            ...(rootCommit === null ? {} : { rootCommit }),
            ...(remoteUrl === null ? {} : { remoteUrl }),
            identityCheckedAt: now,
          }),
      disconnectedAt: undefined,
      updatedAt: now,
      lastAccessedAt: now,
    }));
    set((state) => ({
      disconnectedWorkspaces: state.disconnectedWorkspaces.filter(
        (entry) => entry.id !== workspaceId,
      ),
      workspaces: [
        reconnectedWorkspace,
        ...state.workspaces.filter((entry) => entry.id !== workspaceId),
      ],
      projects: [
        ...reconnectedProjects,
        ...state.projects.filter(
          (project) => !reconnectedProjects.some((entry) => entry.id === project.id),
        ),
      ],
    }));
    return reconnectedWorkspace;
  };
};
