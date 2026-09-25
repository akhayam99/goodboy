import { evaluateStorageNudge } from './evaluateStorageNudge';
import {
  STORAGE_LAST_NUDGE_AT_KEY,
  STORAGE_LAST_NUDGE_BYTES_KEY,
  STORAGE_SUGGEST_AFTER_KEY,
  storedNumberOf,
  suggestAfterDaysOf,
} from './storageSettings';
import { summarizeStorage } from './summarizeStorage';
import type { GetFn, SetFn } from './types';

export const checkStorageNudge = (_set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    await Promise.all([
      get().loadSetting(STORAGE_SUGGEST_AFTER_KEY),
      get().loadSetting(STORAGE_LAST_NUDGE_AT_KEY),
      get().loadSetting(STORAGE_LAST_NUDGE_BYTES_KEY),
    ]).catch(() => undefined);
    const state = get();
    const suggestAfterDays = suggestAfterDaysOf({ settings: state.settings });
    const now = Date.now();
    const summary = summarizeStorage({ folders: state.storageFolders, now, suggestAfterDays });
    const nudge = evaluateStorageNudge({
      canGoBytes: summary.canGo.bytes,
      canGoCount: summary.canGo.count,
      unownedCount: summary.unowned,
      diskFreeBytes: state.storageStats?.diskFreeBytes ?? null,
      suggestAfterDays,
      lastNudgeAt: storedNumberOf({ settings: state.settings, key: STORAGE_LAST_NUDGE_AT_KEY }),
      lastNudgeBytes: storedNumberOf({
        settings: state.settings,
        key: STORAGE_LAST_NUDGE_BYTES_KEY,
      }),
      now,
    });
    if (nudge.kind === 'none') {
      return;
    }
    await get().emitNotification({
      kind: 'storage-reclaimable',
      severity: nudge.severity,
      title: nudge.title,
      body: nudge.body,
      action: { kind: 'open-storage', filter: 'review' },
      coalesceKey: 'storage-reclaimable',
    });
    await get().saveSetting(STORAGE_LAST_NUDGE_AT_KEY, String(now));
    await get().saveSetting(STORAGE_LAST_NUDGE_BYTES_KEY, String(nudge.bytes));
  };
};
