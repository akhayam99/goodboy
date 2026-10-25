import type {
  PersistedSessionViewPrefs,
  SessionGroupKey,
  SessionPageView,
  SessionSortKey,
  SessionStage,
  SessionViewPrefs,
  WorkspaceId,
} from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import { STORAGE_PREFIXES, persistedPref } from '../../../shared/lib/storage-keys';
import { DEFAULT_PREFS, VALID_GROUPS, VALID_PAGE_VIEWS, VALID_SORTS, VALID_STAGES } from './types';

const PREFS_VERSION = 3;
const PREVIOUS_PREFS_VERSION = 2;

type WorkspaceParams = {
  readonly workspaceId: WorkspaceId;
};

type WriteParams = WorkspaceParams & {
  readonly prefs: SessionViewPrefs;
};

type PrefParams = WorkspaceParams & {
  readonly onStale: () => void;
};

type FlagParams = {
  readonly value: unknown;
  readonly fallback: boolean;
};

const sortOf = (value: unknown): SessionSortKey =>
  VALID_SORTS.find((key) => key === value) ?? DEFAULT_PREFS.sort;

const groupOf = (value: unknown): SessionGroupKey =>
  VALID_GROUPS.find((key) => key === value) ?? DEFAULT_PREFS.group;

const pageViewOf = (value: unknown): SessionPageView =>
  VALID_PAGE_VIEWS.find((view) => view === value) ?? DEFAULT_PREFS.pageView;

const stagesOf = (value: unknown): ReadonlyArray<SessionStage> =>
  Array.isArray(value) ? VALID_STAGES.filter((stage) => value.includes(stage)) : [];

const flagOf = ({ value, fallback }: FlagParams): boolean =>
  typeof value === 'boolean' ? value : fallback;

const prefsPref = ({ workspaceId, onStale }: PrefParams) =>
  persistedPref<SessionViewPrefs>({
    key: `${STORAGE_PREFIXES.sessionView}${workspaceId}`,
    fallback: DEFAULT_PREFS,
    parse: (raw) => {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) {
        onStale();
        return undefined;
      }
      const isCurrent = parsed['v'] === PREFS_VERSION;
      if (!isCurrent && parsed['v'] !== PREVIOUS_PREFS_VERSION) {
        onStale();
        return undefined;
      }
      if (!isCurrent) {
        onStale();
      }
      return {
        pageView: pageViewOf(parsed['pageView']),
        sort: sortOf(parsed['sort']),
        group: groupOf(parsed['group']),
        isArchivedShown: flagOf({
          value: parsed['isArchivedShown'],
          fallback: DEFAULT_PREFS.isArchivedShown,
        }),
        isFoldOpen: flagOf({ value: parsed['isFoldOpen'], fallback: DEFAULT_PREFS.isFoldOpen }),
        statusFilter: isCurrent ? stagesOf(parsed['statusFilter']) : [],
      };
    },
    serialize: (prefs) => {
      const persisted: PersistedSessionViewPrefs = { v: PREFS_VERSION, ...prefs };
      return JSON.stringify(persisted);
    },
  });

const NEVER_STALE = (): void => undefined;

export const readSessionViewPrefs = ({ workspaceId }: WorkspaceParams): SessionViewPrefs => {
  let isStale = false;
  const pref = prefsPref({
    workspaceId,
    onStale: () => {
      isStale = true;
    },
  });
  const prefs = pref.read();
  if (isStale) {
    pref.write(prefs);
  }
  return prefs;
};

export const writeSessionViewPrefs = ({ workspaceId, prefs }: WriteParams): void =>
  prefsPref({ workspaceId, onStale: NEVER_STALE }).write(prefs);
