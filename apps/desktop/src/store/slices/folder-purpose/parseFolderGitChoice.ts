import type { FolderGitChoice } from './state';

type ParseParams = {
  readonly raw: string | null;
};

export const parseFolderGitChoice = ({ raw }: ParseParams): FolderGitChoice | null =>
  raw === 'in-place' ? raw : null;
