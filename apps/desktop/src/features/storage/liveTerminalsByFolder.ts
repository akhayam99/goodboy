import type { TerminalTab } from '../../shared/types/terminal';
import type { StorageFolder, StorageFolderTerminals } from '../../store/slices/storage/types';
import { terminalsInFolder } from '../terminal/terminalsInFolder';

type Params = {
  readonly folders: ReadonlyArray<StorageFolder>;
  readonly tabs: Readonly<Record<string, ReadonlyArray<TerminalTab>>>;
};

export const liveTerminalsByFolder = ({ folders, tabs }: Params): StorageFolderTerminals => {
  const found = new Map<string, ReadonlyArray<TerminalTab>>();
  for (const folder of folders) {
    const live = terminalsInFolder({ tabs, path: folder.path, mountId: folder.mountId });
    if (live.length > 0) {
      found.set(folder.path, live);
    }
  }
  return found;
};
