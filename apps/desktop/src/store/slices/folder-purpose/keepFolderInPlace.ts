import { setProjectValue, updateProjectKind } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { projectById } from '../projects/projectIndex';
import { storeFolderGitChoice } from './storeFolderGitChoice';
import { storeFolderGitNotice } from './storeFolderGitNotice';
import { storeProjectKind } from './storeProjectKind';
import type { FolderGitDeps, FolderGitTargetParams } from './types';

export const keepFolderInPlace = ({ set, get }: FolderGitDeps) => {
  return async ({ projectId }: FolderGitTargetParams): Promise<void> => {
    const project = projectById(get().projects, projectId);
    if (project === undefined) {
      throw new Error('This folder is no longer in a workspace');
    }
    await setProjectValue({
      db: tauriDatabase,
      projectId,
      key: 'folder.git',
      value: 'in-place',
    });
    if (project.kind === 'repo') {
      await updateProjectKind({
        db: tauriDatabase,
        id: projectId,
        kind: 'folder',
        rootPath: project.rootPath,
      });
      storeProjectKind({ set, projectId, kind: 'folder', rootPath: project.rootPath });
    }
    storeFolderGitChoice({ set, projectId, choice: 'in-place' });
    storeFolderGitNotice({ set, projectId, notice: null });
  };
};
