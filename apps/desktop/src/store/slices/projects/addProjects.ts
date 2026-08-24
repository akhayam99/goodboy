import type { Project, WorkspaceId } from '@goodboy/types';
import { addProject, type ProjectAttachConflict } from './addProject';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly workspaceId: WorkspaceId;
  readonly rootPaths: ReadonlyArray<string>;
};

export type AddProjectsResult = {
  readonly linked: ReadonlyArray<Project>;
  readonly conflicts: ReadonlyArray<ProjectAttachConflict>;
};

export const addProjects = (set: SetFn, get: GetFn) => {
  const linkOne = addProject(set, get);
  return async ({ workspaceId, rootPaths }: Input): Promise<AddProjectsResult> => {
    const linked: Project[] = [];
    const conflicts: ProjectAttachConflict[] = [];
    for (const rootPath of rootPaths) {
      const result = await linkOne({ workspaceId, rootPath, requireRepo: true });
      if (result.kind === 'linked') {
        linked.push(result.project);
        continue;
      }
      conflicts.push(result.conflict);
    }
    return { linked, conflicts };
  };
};
