import type { Project, Workspace, WorkspaceId } from '@goodboy/types';
import { deleteSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { projectFolderCreate } from '../../../shared/lib/repo';
import type { GetFn, SetFn } from '../../slice-types';
import { bootstrapPhaseKey } from './phase';

const projectOfWorkspace = (
  projects: ReadonlyArray<Project>,
  workspaceId: WorkspaceId,
): Project | undefined => {
  for (const candidate of projects) {
    if (candidate.workspaceId === workspaceId) {
      return candidate;
    }
  }
  return undefined;
};

type Input = {
  readonly parentPath: string;
  readonly name: string;
};

export type NewProject = {
  readonly workspace: Workspace;
  readonly project: Project;
};

export const createNewProject = (set: SetFn, get: GetFn) => {
  return async ({ parentPath, name }: Input): Promise<NewProject> => {
    const trimmedName = name.trim();
    const created = await projectFolderCreate({ parentPath, name: trimmedName });
    const workspace = await get().addWorkspace({ rootPath: created.rootPath, name: trimmedName });
    const project = projectOfWorkspace(get().projects, workspace.id);
    if (project === undefined) {
      throw new Error('the new project was not registered');
    }
    try {
      await get().setBootstrapPhase({ projectId: project.id, patch: { stage: 'first-lap' } });
    } catch (error) {
      await deleteSetting(tauriDatabase, bootstrapPhaseKey(project.id)).catch(() => undefined);
      set((state) => {
        const { [project.id]: _removed, ...rest } = state.bootstrapPhase;
        return { bootstrapPhase: rest };
      });
      throw error;
    }
    return { workspace, project };
  };
};
