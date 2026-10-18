import type { ProjectId } from '@goodboy/types';
import type { FolderGitChoice } from './state';

const CHOICE_KEY_PREFIX = 'folder.git.';

type KeyParams = {
  readonly projectId: ProjectId;
};

type ParseParams = {
  readonly raw: string | null;
};

export const folderGitChoiceKey = ({ projectId }: KeyParams): string =>
  `${CHOICE_KEY_PREFIX}${projectId}`;

export const parseFolderGitChoice = ({ raw }: ParseParams): FolderGitChoice | null =>
  raw === 'in-place' ? raw : null;
