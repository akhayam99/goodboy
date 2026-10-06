import type {
  PersistedSessionViewPrefs,
  SessionGroupKey,
  SessionSortKey,
  SessionViewPrefs,
  WorkspaceId,
} from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../../shared/lib/storage-keys';
import { DEFAULT_PREFS, VALID_GROUPS, VALID_SORTS } from './types';

const PREFS_VERSION = 2;

const storageKey = (workspaceId: WorkspaceId): string =>
  `${STORAGE_PREFIXES.sessionView}${workspaceId}`;

export const writeToStorage = (workspaceId: WorkspaceId, prefs: SessionViewPrefs): void => {
  try {
    const persisted: PersistedSessionViewPrefs = { v: PREFS_VERSION, ...prefs };
    localStorage.setItem(storageKey(workspaceId), JSON.stringify(persisted));
  } catch {
    return;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const sortOf = (value: unknown): SessionSortKey =>
  VALID_SORTS.find((key) => key === value) ?? DEFAULT_PREFS.sort;

const groupOf = (value: unknown): SessionGroupKey =>
  VALID_GROUPS.find((key) => key === value) ?? DEFAULT_PREFS.group;

const flagOf = ({ value, fallback }: { readonly value: unknown; readonly fallback: boolean }) =>
  typeof value === 'boolean' ? value : fallback;

export const readFromStorage = (workspaceId: WorkspaceId): SessionViewPrefs => {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    if (raw === null || raw === '') {
      return DEFAULT_PREFS;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed['v'] !== PREFS_VERSION) {
      writeToStorage(workspaceId, DEFAULT_PREFS);
      return DEFAULT_PREFS;
    }
    const prefs: SessionViewPrefs = {
      sort: sortOf(parsed['sort']),
      group: groupOf(parsed['group']),
      isArchivedShown: flagOf({
        value: parsed['isArchivedShown'],
        fallback: DEFAULT_PREFS.isArchivedShown,
      }),
      isFoldOpen: flagOf({ value: parsed['isFoldOpen'], fallback: DEFAULT_PREFS.isFoldOpen }),
    };
    return prefs;
  } catch {
    return DEFAULT_PREFS;
  }
};
