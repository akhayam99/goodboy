import { useMemo } from 'react';
import { useAppStore } from '../../../store';
import type { StorageScope } from '../../../store/slices/storage/types';
import {
  STORAGE_SUGGEST_AFTER_KEY,
  suggestAfterDaysOf,
} from '../../../store/slices/storage/storageSettings';
import {
  summarizeStorage,
  type StorageSummary,
} from '../../../store/slices/storage/summarizeStorage';
import { filterFoldersByScope } from '../filterFoldersByScope';

type Params = {
  readonly scope?: StorageScope;
};

type StorageSummaryView = {
  readonly summary: StorageSummary;
  readonly suggestAfterDays: number;
  readonly now: number;
};

const ALL_SCOPE: StorageScope = { kind: 'all' };

export const useStorageSummary = ({ scope = ALL_SCOPE }: Params = {}): StorageSummaryView => {
  const folders = useAppStore((state) => state.storageFolders);
  const roots = useAppStore((state) => state.storageRoots);
  const rawDays = useAppStore((state) => state.settings[STORAGE_SUGGEST_AFTER_KEY]);
  return useMemo(() => {
    const suggestAfterDays = suggestAfterDaysOf({
      settings: rawDays === undefined ? {} : { [STORAGE_SUGGEST_AFTER_KEY]: rawDays },
    });
    const now = Date.now();
    const scoped = filterFoldersByScope({ folders, roots, scope });
    return {
      summary: summarizeStorage({ folders: scoped, now, suggestAfterDays }),
      suggestAfterDays,
      now,
    };
  }, [folders, roots, rawDays, scope]);
};
