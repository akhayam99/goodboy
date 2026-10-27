import { deleteProjectValue, updateProjectKind } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { validateGitRepo } from '../../../shared/lib/repo';
import { trimTrailingSeparators } from '../terminal/terminalOwner';
import { projectById } from '../projects/projectIndex';
import { storeFolderGitChoice } from './storeFolderGitChoice';
import { storeFolderGitNotice } from './storeFolderGitNotice';
import { storeProjectKind } from './storeProjectKind';
import type { FolderGitDeps, FolderGitTargetParams } from './types';

export const switchFolderToRepo = ({ set, get }: FolderGitDeps) => {
  return async ({ projectId }: FolderGitTargetParams): Promise<void> => {
    const project = projectById(get().projects, projectId);
    if (project === undefined) {
      throw new Error('This folder is no longer in a workspace');
    }
    if (project.kind !== 'folder') {
      storeFolderGitNotice({ set, projectId, notice: null });
      return;
    }
    const check = await validateGitRepo(project.rootPath);
    if (check.isRepo === false || check.rootPath == null) {
      throw new Error(check.error ?? `Goodboy no longer finds git in ${project.name}`);
    }
    const rootPath = check.rootPath;
    const taken = get().projects.filter(
      (candidate) =>
        candidate.id !== projectId &&
        candidate.workspaceId === project.workspaceId &&
        trimTrailingSeparators({ path: candidate.rootPath }) ===
          trimTrailingSeparators({ path: rootPath }),
    )[0];
    if (taken !== undefined) {
      throw new Error(`${taken.name} already works on the repository at ${rootPath}`);
    }
    if (get().folderPurpose[projectId] === 'documents') {
      await get().setFolderPurpose({ projectId, purpose: 'code' });
    }
    await deleteProjectValue({ db: tauriDatabase, projectId, key: 'folder.git' });
    await updateProjectKind({ db: tauriDatabase, id: projectId, kind: 'repo', rootPath });
    storeProjectKind({ set, projectId, kind: 'repo', rootPath });
    storeFolderGitChoice({ set, projectId, choice: null });
    storeFolderGitNotice({ set, projectId, notice: null });
  };
};
