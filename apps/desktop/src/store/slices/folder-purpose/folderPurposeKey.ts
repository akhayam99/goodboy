import { brandId, type FolderPurpose, type ProjectId } from '@goodboy/types';

const PURPOSE_KEY_PREFIX = 'folder.purpose.';

type KeyParams = {
  readonly projectId: ProjectId;
};

type KeyOfParams = {
  readonly key: string;
};

type ParseParams = {
  readonly raw: string | null;
};

export const folderPurposeKey = ({ projectId }: KeyParams): string =>
  `${PURPOSE_KEY_PREFIX}${projectId}`;

export const folderPurposePrefix = (): string => PURPOSE_KEY_PREFIX;

export const projectIdOfPurposeKey = ({ key }: KeyOfParams): ProjectId | null => {
  if (!key.startsWith(PURPOSE_KEY_PREFIX) || key.length === PURPOSE_KEY_PREFIX.length) {
    return null;
  }
  return brandId<ProjectId>({ value: key.slice(PURPOSE_KEY_PREFIX.length) });
};

export const parseFolderPurpose = ({ raw }: ParseParams): FolderPurpose | null =>
  raw === 'code' || raw === 'documents' ? raw : null;
