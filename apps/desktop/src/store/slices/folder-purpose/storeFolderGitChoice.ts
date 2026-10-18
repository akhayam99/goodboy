import type { ProjectId } from '@goodboy/types';
import type { FolderGitChoice } from './state';
import type { SetFn } from './types';

type ChoiceParams = {
  readonly set: SetFn;
  readonly projectId: ProjectId;
  readonly choice: FolderGitChoice | null;
};

export const storeFolderGitChoice = ({ set, projectId, choice }: ChoiceParams): void =>
  set((state) => {
    const previous = state.folderGitChoice[projectId] ?? null;
    if (previous === choice) {
      return state;
    }
    if (choice !== null) {
      return { folderGitChoice: { ...state.folderGitChoice, [projectId]: choice } };
    }
    const { [projectId]: _dropped, ...rest } = state.folderGitChoice;
    return { folderGitChoice: rest };
  });
