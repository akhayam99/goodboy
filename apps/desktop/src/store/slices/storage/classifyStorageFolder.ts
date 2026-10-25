import type { StorageBucket, StorageFolder, StorageFolderStatus } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

type FolderParams = {
  readonly folder: StorageFolder;
};

type StatusParams = FolderParams & {
  readonly liveTerminals: number;
};

type FolderAtParams = FolderParams & {
  readonly now: number;
};

type IdleParams = FolderAtParams & {
  readonly suggestAfterDays: number;
};

type SuggestParams = IdleParams & {
  readonly liveTerminals: number;
};

export const storageFolderStatus = ({
  folder,
  liveTerminals,
}: StatusParams): StorageFolderStatus => {
  if (folder.origin === 'in-use') {
    return 'in-use';
  }
  if (folder.facts === null) {
    return 'checking';
  }
  if (folder.facts.verdict === 'safe' && liveTerminals > 0) {
    return 'terminal-open';
  }
  return folder.facts.verdict;
};

const isStorageFolderKept = ({ folder, now }: FolderAtParams): boolean => {
  if (folder.keptAt === null) {
    return false;
  }
  return folder.keptUntil === null || folder.keptUntil > now;
};

export const storageFolderBucket = ({ folder, now }: FolderAtParams): StorageBucket => {
  if (folder.origin === 'in-use') {
    return 'in-use';
  }
  return isStorageFolderKept({ folder, now }) ? 'kept' : 'review';
};

export const storageFolderLastChange = ({ folder }: FolderParams): number | null => {
  const commit = folder.facts?.lastCommitAt ?? null;
  const activity = folder.sessionActivityAt;
  if (commit === null) {
    return activity;
  }
  if (activity === null) {
    return commit;
  }
  return Math.max(commit, activity);
};

export const isStorageFolderIdle = ({ folder, now, suggestAfterDays }: IdleParams): boolean => {
  const lastChange = storageFolderLastChange({ folder });
  if (lastChange === null) {
    return false;
  }
  return now - lastChange >= suggestAfterDays * DAY_MS;
};

export const isStorageFolderSuggested = ({
  folder,
  now,
  suggestAfterDays,
  liveTerminals,
}: SuggestParams): boolean =>
  storageFolderBucket({ folder, now }) === 'review' &&
  storageFolderStatus({ folder, liveTerminals }) === 'safe' &&
  isStorageFolderIdle({ folder, now, suggestAfterDays });

export const STORAGE_DAY_MS = DAY_MS;
