import type { FolderPurpose } from '@goodboy/types';

type ParseParams = {
  readonly raw: string | null;
};

export const parseFolderPurpose = ({ raw }: ParseParams): FolderPurpose | null =>
  raw === 'code' || raw === 'documents' ? raw : null;
