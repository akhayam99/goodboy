import type { ProjectId } from '@goodboy/types';
import type { FolderGitNotice } from './state';
import type { SetFn } from './types';

type NoticeParams = {
  readonly set: SetFn;
  readonly projectId: ProjectId;
  readonly notice: FolderGitNotice | null;
};

export const storeFolderGitNotice = ({ set, projectId, notice }: NoticeParams): void =>
  set((state) => {
    if (notice !== null) {
      return { folderGitNotice: { ...state.folderGitNotice, [projectId]: notice } };
    }
    if (state.folderGitNotice[projectId] === undefined) {
      return state;
    }
    const { [projectId]: _dropped, ...rest } = state.folderGitNotice;
    return { folderGitNotice: rest };
  });
