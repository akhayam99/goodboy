import type {
  PersistedSessionViewPrefs,
  SessionGroupKey,
  SessionSortKey,
  SessionViewPrefs,
  WorkspaceId,
} from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../../shared/lib/storage-keys';
import { DEFAULT_PREFS, VALID_GROUPS, VALID_SORTS } from './types';

function storageKey(workspaceId: WorkspaceId): string {
  return `${STORAGE_PREFIXES.sessionView}${workspaceId}`;
}

export const writeToStorage = (workspaceId: WorkspaceId, prefs: SessionViewPrefs): void => {
  try {
    const persisted: PersistedSessionViewPrefs = { v: 1, ...prefs };
    localStorage.setItem(storageKey(workspaceId), JSON.stringify(persisted));
  } catch {
    // Swallow quota errors, prefs are non-critical.
  }
};

export const readFromStorage = (workspaceId: WorkspaceId): SessionViewPrefs => {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    if (!raw) return DEFAULT_PREFS;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as Record<string, unknown>)['v'] !== 1
    ) {
      writeToStorage(workspaceId, DEFAULT_PREFS);
      return DEFAULT_PREFS;
    }
    const obj = parsed as Record<string, unknown>;
    const sort = VALID_SORTS.has(obj['sort'] as SessionSortKey)
      ? (obj['sort'] as SessionSortKey)
      : DEFAULT_PREFS.sort;
    const group = VALID_GROUPS.has(obj['group'] as SessionGroupKey)
      ? (obj['group'] as SessionGroupKey)
      : DEFAULT_PREFS.group;
    const prefs: SessionViewPrefs = { sort, group };
    if (sort !== obj['sort'] || group !== obj['group']) {
      writeToStorage(workspaceId, prefs);
    }
    return prefs;
  } catch {
    return DEFAULT_PREFS;
  }
};
