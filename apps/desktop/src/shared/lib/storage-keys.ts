const PREFIX = 'goodboy:';

export const STORAGE_KEYS = {
  theme: `${PREFIX}theme`,
  pricingSortKey: `${PREFIX}pricing-sort-key`,
  diffLayoutMode: `${PREFIX}diff-layout-mode`,
  diffWrap: `${PREFIX}diff-wrap`,
  sessionSidebarCollapsed: `${PREFIX}sessions-sidebar-collapsed`,
  leftSidebarWidth: `${PREFIX}left-sidebar-width:v2`,
  changelogCache: `${PREFIX}changelog-cache:v1`,
  updateSweep: `${PREFIX}update-sweep:v1`,
  paletteFrecency: `${PREFIX}palette-frecency:v1`,
  chatUnread: `${PREFIX}chat-unread:v1`,
  zoom: `${PREFIX}zoom`,
  activityFilter: `${PREFIX}activity-filter`,
  windowReloadIntent: `${PREFIX}window-reload-intent`,
} as const;

export const STORAGE_PREFIXES = {
  diffReviewed: `${PREFIX}diff-reviewed:`,
  sessionView: `${PREFIX}session-view:`,
  sessionFilters: `${PREFIX}session-filters:`,
  cursorMaxMode: `${PREFIX}cursor-max-mode:`,
  inboxKindFilter: `${PREFIX}inbox-kind-filter:`,
  artifactDrafts: `${PREFIX}artifact-drafts:`,
  workflowBuilderMode: `${PREFIX}workflow-builder-mode:`,
  boardCollapsed: `${PREFIX}board-collapsed:v1:`,
  scriptsGroupsCollapsed: `${PREFIX}scripts-groups-collapsed:v1:`,
  scriptsPackagesCollapsed: `${PREFIX}scripts-packages-collapsed:v1:`,
  turnCursor: `${PREFIX}turn-cursor:`,
} as const;

export const wipeLocalStorage = (): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) {
      keys.push(key);
    }
  }
  for (const key of keys) localStorage.removeItem(key);
};

type PrefArea = 'local' | 'session';

type PersistedPrefParams<T> = {
  readonly key: string;
  readonly parse: (raw: string) => T | undefined;
  readonly fallback: T;
  readonly serialize?: (value: T) => string;
  readonly area?: PrefArea;
};

export type PersistedPref<T> = {
  readonly read: () => T;
  readonly write: (value: T) => void;
  readonly clear: () => void;
};

const storageFor = (area: PrefArea): Storage =>
  area === 'session' ? sessionStorage : localStorage;

export const persistedPref = <T>({
  key,
  parse,
  fallback,
  serialize = (value) => JSON.stringify(value),
  area = 'local',
}: PersistedPrefParams<T>): PersistedPref<T> => ({
  read: () => {
    try {
      const raw = storageFor(area).getItem(key);
      if (raw === null) {
        return fallback;
      }
      const parsed = parse(raw);
      return parsed === undefined ? fallback : parsed;
    } catch {
      return fallback;
    }
  },
  write: (value) => {
    try {
      storageFor(area).setItem(key, serialize(value));
    } catch {
      return;
    }
  },
  clear: () => {
    try {
      storageFor(area).removeItem(key);
    } catch {
      return;
    }
  },
});
