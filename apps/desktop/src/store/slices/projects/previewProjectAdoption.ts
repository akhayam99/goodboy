import type { WorkspaceId } from '@goodboy/types';
import { findProjectByRootPath } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { validateGitRepo } from '../../../shared/lib/repo';
import { buildAttachConflict, type ProjectAttachConflict } from './addProject';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly workspaceId: WorkspaceId | null;
  readonly rootPath: string;
};

export const previewProjectAdoption = (_set: SetFn, get: GetFn) => {
  return async ({ workspaceId, rootPath }: Input): Promise<ProjectAttachConflict | null> => {
    const check = await validateGitRepo(rootPath);
    const isRepo = check.isRepo && check.rootPath != null && check.rootPath !== '';
    const resolvedRoot = isRepo ? check.rootPath : check.resolvedPath;
    if (resolvedRoot == null || resolvedRoot === '') {
      return null;
    }
    const existing = await findProjectByRootPath({ db: tauriDatabase, rootPath: resolvedRoot });
    if (existing === null || existing.workspaceId === workspaceId) {
      return null;
    }
    return buildAttachConflict({ get, project: existing });
  };
};
