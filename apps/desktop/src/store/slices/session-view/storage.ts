import type {
  PersistedSessionViewPrefs,
  SessionGroupKey,
  SessionSortKey,
  SessionStage,
  SessionViewPrefs,
  WorkspaceId,
} from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../../shared/lib/storage-keys';
import { DEFAULT_PREFS, VALID_GROUPS, VALID_SORTS, VALID_STAGES } from './types';

const PREFS_VERSION = 3;
const PREVIOUS_PREFS_VERSION = 2;

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

const stagesOf = (value: unknown): ReadonlyArray<SessionStage> =>
  Array.isArray(value) ? VALID_STAGES.filter((stage) => value.includes(stage)) : [];

const flagOf = ({ value, fallback }: { readonly value: unknown; readonly fallback: boolean }) =>
  typeof value === 'boolean' ? value : fallback;

export const readFromStorage = (workspaceId: WorkspaceId): SessionViewPrefs => {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    if (raw === null || raw === '') {
      return DEFAULT_PREFS;
    }
    const parsed: unknown = JSON.parse(raw);
    const isCurrent = isRecord(parsed) && parsed['v'] === PREFS_VERSION;
    const isPrevious = isRecord(parsed) && parsed['v'] === PREVIOUS_PREFS_VERSION;
    if (!isRecord(parsed) || (!isCurrent && !isPrevious)) {
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
      statusFilter: isCurrent ? stagesOf(parsed['statusFilter']) : [],
    };
    if (isPrevious) {
      writeToStorage(workspaceId, prefs);
    }
    return prefs;
  } catch {
    return DEFAULT_PREFS;
  }
};
