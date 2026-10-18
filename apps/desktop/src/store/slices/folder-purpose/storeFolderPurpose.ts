import type { FolderPurpose, ProjectId } from '@goodboy/types';
import type { SetFn } from './types';

export const FOLDER_PURPOSE_QUEUE_KEY = 'folder-purpose';

type Params = {
  readonly set: SetFn;
  readonly projectId: ProjectId;
  readonly purpose: FolderPurpose | null;
};

export const storeFolderPurpose = ({ set, projectId, purpose }: Params): void =>
  set((state) => {
    const previous = state.folderPurpose[projectId] ?? null;
    if (previous === purpose) {
      return state;
    }
    if (purpose === null) {
      const { [projectId]: _dropped, ...rest } = state.folderPurpose;
      return { folderPurpose: rest };
    }
    return { folderPurpose: { ...state.folderPurpose, [projectId]: purpose } };
  });
