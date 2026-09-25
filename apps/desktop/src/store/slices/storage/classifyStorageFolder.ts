import type { WorktreeRemovalReason } from '@goodboy/types';
import type { StorageBucket, StorageFolder, StorageFolderStatus } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

const CHANGE_REASONS: ReadonlyArray<WorktreeRemovalReason> = [
  'staged-changes',
  'unstaged-changes',
  'untracked-files',
];

type FolderParams = {
  readonly folder: StorageFolder;
};

type FolderAtParams = FolderParams & {
  readonly now: number;
};

type SuggestParams = FolderAtParams & {
  readonly suggestAfterDays: number;
};

export const storageFolderStatus = ({ folder }: FolderParams): StorageFolderStatus => {
  if (folder.origin === 'in-use') {
    return 'in-use';
  }
  const facts = folder.facts;
  if (facts === null) {
    return 'checking';
  }
  const has = (reason: WorktreeRemovalReason): boolean => facts.reasons.includes(reason);
  if (has('writer-lease-held')) {
    return 'writing';
  }
  if (has('operation-in-progress') || has('unmerged-conflicts')) {
    return 'operation';
  }
  if (has('not-registered')) {
    return 'not-tracked';
  }
  if (facts.changedFiles > 0 || CHANGE_REASONS.some(has)) {
    return 'dirty';
  }
  if (facts.reasons.length > 0) {
    return 'unavailable';
  }
  return 'safe';
};

export const isStorageFolderKept = ({ folder, now }: FolderAtParams): boolean => {
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

export const isStorageFolderIdle = ({ folder, now, suggestAfterDays }: SuggestParams): boolean => {
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
}: SuggestParams): boolean =>
  storageFolderBucket({ folder, now }) === 'review' &&
  storageFolderStatus({ folder }) === 'safe' &&
  isStorageFolderIdle({ folder, now, suggestAfterDays });

export const STORAGE_DAY_MS = DAY_MS;
