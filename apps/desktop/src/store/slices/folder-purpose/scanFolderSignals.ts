import type { FolderSignals } from '@goodboy/types';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { folderPurposeOf } from '../../../features/workspace/folderPurposeOf';
import type { FolderSignalsRead } from './state';
import type { FolderSignalsDeps, ScanFolderSignalsParams } from './types';

const readSignals = async ({ path }: ScanFolderSignalsParams): Promise<FolderSignalsRead> => {
  const signals = await invokeCommand<FolderSignals>('read_folder_signals', { path });
  return { signals, preselected: folderPurposeOf({ signals }) };
};

export const scanFolderSignals = ({ set, get, latest }: FolderSignalsDeps) => {
  return async ({ path }: ScanFolderSignalsParams): Promise<FolderSignalsRead | null> => {
    const outcome = await latest.run({
      key: path,
      request: () => readSignals({ path }),
      apply: (read) =>
        set((state) => ({ folderSignals: { ...state.folderSignals, [path]: read } })),
    });
    if (outcome === 'stale') {
      return null;
    }
    return get().folderSignals[path] ?? null;
  };
};
