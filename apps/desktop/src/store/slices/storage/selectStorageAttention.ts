import type { AppStore } from '../../store';
import { formatBytes } from '../../../shared/utils/formatBytes';
import { NUDGE_MIN_BYTES, isLowDisk } from './evaluateStorageNudge';
import { suggestAfterDaysOf } from './storageSettings';
import { summarizeStorage } from './summarizeStorage';

type Params = {
  readonly state: Pick<AppStore, 'storageFolders' | 'settings' | 'storageStats'>;
};

type StorageAttention = {
  readonly label: string;
  readonly tone: 'info' | 'warning';
};

type AttentionParams = Params & {
  readonly nowMs: number;
};

export const storageAttention = ({ state, nowMs }: AttentionParams): StorageAttention | null => {
  if (state.storageFolders.length === 0) {
    return null;
  }
  const summary = summarizeStorage({
    folders: state.storageFolders,
    now: nowMs,
    suggestAfterDays: suggestAfterDaysOf({ settings: state.settings }),
  });
  const canGoBytes = summary.canGo.bytes;
  const diskFreeBytes = state.storageStats?.diskFreeBytes ?? null;
  const label = `${formatBytes({ bytes: canGoBytes })} can go`;
  if (isLowDisk({ diskFreeBytes, canGoBytes })) {
    return { label, tone: 'warning' };
  }
  return canGoBytes >= NUDGE_MIN_BYTES ? { label, tone: 'info' } : null;
};
