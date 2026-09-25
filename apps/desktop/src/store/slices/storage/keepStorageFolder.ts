import { setWorktreeLedgerKeep } from '@goodboy/db';
import type { IsoDateTime } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { STORAGE_DAY_MS } from './classifyStorageFolder';
import { STORAGE_KEPT_ARCHIVED_KEY, keptArchivedOf } from './storageSettings';
import type { GetFn, KeepStorageFolderParams, SetFn } from './types';

type IsoParams = {
  readonly value: number | null;
};

const toIso = ({ value }: IsoParams): IsoDateTime | null =>
  value === null ? null : (new Date(value).toISOString() as IsoDateTime);

export const keepStorageFolder = (set: SetFn, get: GetFn) => {
  return async ({ path, days, isStopping = false }: KeepStorageFolderParams): Promise<void> => {
    const folder = get().storageFolders.find((candidate) => candidate.path === path);
    if (folder === undefined || folder.origin === 'in-use') {
      return;
    }
    const now = Date.now();
    const keptAt = isStopping ? null : now;
    const keptUntil = isStopping || days === null ? null : now + days * STORAGE_DAY_MS;
    if (folder.origin === 'ledger') {
      await setWorktreeLedgerKeep({
        db: tauriDatabase,
        worktreePath: path,
        keptAt: toIso({ value: keptAt }),
        keptUntil: toIso({ value: keptUntil }),
      });
    }
    if (folder.origin === 'archived') {
      const current = keptArchivedOf({ settings: get().settings });
      const next = Object.fromEntries(
        Object.entries(current).filter(([candidate]) => candidate !== path),
      );
      const value = keptAt === null ? next : { ...next, [path]: { keptAt, keptUntil } };
      await get().saveSetting(STORAGE_KEPT_ARCHIVED_KEY, JSON.stringify(value));
    }
    set((state) => ({
      storageFolders: state.storageFolders.map((candidate) =>
        candidate.path === path ? { ...candidate, keptAt, keptUntil } : candidate,
      ),
    }));
  };
};
