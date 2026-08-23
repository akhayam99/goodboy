import type { Project, WorkspaceId } from '@goodboy/types';
import { addProject } from './addProject';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly workspaceId: WorkspaceId;
  readonly rootPaths: ReadonlyArray<string>;
};

export const addProjects = (set: SetFn, get: GetFn) => {
  const linkOne = addProject(set, get);
  return async ({ workspaceId, rootPaths }: Input): Promise<ReadonlyArray<Project>> => {
    const projects: Project[] = [];
    for (const rootPath of rootPaths) {
      projects.push(await linkOne({ workspaceId, rootPath, requireRepo: true }));
    }
    return projects;
  };
};
