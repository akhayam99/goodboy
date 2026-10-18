import { storeFolderGitNotice } from './storeFolderGitNotice';
import type { FolderGitDeps, FolderGitTargetParams } from './types';

export const dismissFolderGitNotice = ({ set }: FolderGitDeps) => {
  return ({ projectId }: FolderGitTargetParams): void => {
    storeFolderGitNotice({ set, projectId, notice: null });
  };
};
