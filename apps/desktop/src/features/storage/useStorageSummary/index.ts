import { useMemo } from 'react';
import { useAppStore } from '../../../store';
import {
  STORAGE_SUGGEST_AFTER_KEY,
  suggestAfterDaysOf,
} from '../../../store/slices/storage/storageSettings';
import {
  summarizeStorage,
  type StorageSummary,
} from '../../../store/slices/storage/summarizeStorage';

type StorageSummaryView = {
  readonly summary: StorageSummary;
  readonly suggestAfterDays: number;
  readonly now: number;
};

export const useStorageSummary = (): StorageSummaryView => {
  const folders = useAppStore((state) => state.storageFolders);
  const rawDays = useAppStore((state) => state.settings[STORAGE_SUGGEST_AFTER_KEY]);
  return useMemo(() => {
    const suggestAfterDays = suggestAfterDaysOf({
      settings: rawDays === undefined ? {} : { [STORAGE_SUGGEST_AFTER_KEY]: rawDays },
    });
    const now = Date.now();
    return { summary: summarizeStorage({ folders, now, suggestAfterDays }), suggestAfterDays, now };
  }, [folders, rawDays]);
};
