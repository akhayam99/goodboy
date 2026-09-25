import { STORAGE_DAY_MS } from './classifyStorageFolder';

const GB = 1024 ** 3;

export const NUDGE_MIN_BYTES = 10 * GB;
export const NUDGE_GROWTH_BYTES = 10 * GB;
export const NUDGE_LOW_DISK_BYTES = 10 * GB;
export const NUDGE_LOW_DISK_MIN_BYTES = GB;
export const NUDGE_QUIET_DAYS = 14;

export type StorageNudgeInput = {
  readonly canGoBytes: number;
  readonly canGoCount: number;
  readonly unownedCount: number;
  readonly diskFreeBytes: number | null;
  readonly suggestAfterDays: number;
  readonly lastNudgeAt: number | null;
  readonly lastNudgeBytes: number | null;
  readonly now: number;
};

export type StorageNudge =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'notify';
      readonly severity: 'info' | 'warning';
      readonly bytes: number;
      readonly title: string;
      readonly body: string;
    };

type GbParams = {
  readonly bytes: number;
};

const wholeGb = ({ bytes }: GbParams): string => `${Math.max(1, Math.round(bytes / GB))} GB`;

export const isLowDisk = ({
  diskFreeBytes,
  canGoBytes,
}: Pick<StorageNudgeInput, 'diskFreeBytes' | 'canGoBytes'>): boolean =>
  diskFreeBytes !== null &&
  diskFreeBytes < NUDGE_LOW_DISK_BYTES &&
  canGoBytes >= NUDGE_LOW_DISK_MIN_BYTES;

export const evaluateStorageNudge = ({
  canGoBytes,
  canGoCount,
  unownedCount,
  diskFreeBytes,
  suggestAfterDays,
  lastNudgeAt,
  lastNudgeBytes,
  now,
}: StorageNudgeInput): StorageNudge => {
  const isQuiet = lastNudgeAt !== null && now - lastNudgeAt < NUDGE_QUIET_DAYS * STORAGE_DAY_MS;
  if (isQuiet) {
    return { kind: 'none' };
  }
  if (isLowDisk({ diskFreeBytes, canGoBytes })) {
    return {
      kind: 'notify',
      severity: 'warning',
      bytes: canGoBytes,
      title: `${wholeGb({ bytes: diskFreeBytes ?? 0 })} free on this disk`,
      body: `Goodboy can free ${wholeGb({ bytes: canGoBytes })} of worktree folders nobody uses.`,
    };
  }
  if (canGoBytes < NUDGE_MIN_BYTES) {
    return { kind: 'none' };
  }
  if (lastNudgeBytes !== null && canGoBytes < lastNudgeBytes + NUDGE_GROWTH_BYTES) {
    return { kind: 'none' };
  }
  const lead =
    unownedCount > canGoCount
      ? `${unownedCount} worktree folders have no session. ${canGoCount} are safe`
      : canGoCount === 1
        ? '1 worktree folder is safe'
        : `${canGoCount} worktree folders are safe`;
  return {
    kind: 'notify',
    severity: 'info',
    bytes: canGoBytes,
    title: `Goodboy can free ${wholeGb({ bytes: canGoBytes })}`,
    body: `${lead} to remove and idle for over ${suggestAfterDays} days.`,
  };
};
