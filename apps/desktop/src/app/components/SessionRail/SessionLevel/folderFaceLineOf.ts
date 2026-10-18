import type { FolderPurpose } from '@goodboy/types';

type Params = Readonly<{ purpose: FolderPurpose | null }>;

export const folderFaceLineOf = ({ purpose }: Params): string => {
  if (purpose === 'documents') {
    return 'Documents · edits in place';
  }
  if (purpose === 'code') {
    return 'No git yet · edits in place';
  }
  return 'Edits in place';
};
