import type { FolderEntry } from './folderEntry';

type Params = {
  readonly folders: ReadonlyArray<FolderEntry>;
};

export const draftFolders = ({ folders }: Params): ReadonlyArray<FolderEntry> =>
  folders.filter((folder) => folder.isIncluded);
