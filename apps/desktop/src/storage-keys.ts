const PREFIX = 'kay-am:';

export const STORAGE_KEYS = {
  theme: `${PREFIX}theme`,
  archivedTasks: `${PREFIX}archived-tasks`,
  pricingSortKey: `${PREFIX}pricing-sort-key`,
  diffSidebarCollapsed: `${PREFIX}diff-sidebar-collapsed`,
} as const;

export const STORAGE_PREFIXES = {
  verbosity: `${PREFIX}verbosity:`,
  effort: `${PREFIX}effort:`,
  model: `${PREFIX}model:`,
  provider: `${PREFIX}provider:`,
  contextPanelOpen: `${PREFIX}context-panel-open:`,
} as const;

const LEGACY_KEY_MAP: Record<string, string> = {
  'kayam:theme': STORAGE_KEYS.theme,
  'kayam:archived-tasks': STORAGE_KEYS.archivedTasks,
  'pricing-sort-key': STORAGE_KEYS.pricingSortKey,
  'kayam:left-sidebar-width': 'kay-am:left-sidebar-width',
  'kayam:right-sidebar-width': 'kay-am:right-sidebar-width',
};

const LEGACY_PREFIX_MAP: Record<string, string> = {
  'kayam:verbosity:': STORAGE_PREFIXES.verbosity,
  'kayam:effort:': STORAGE_PREFIXES.effort,
  'kayam:model:': STORAGE_PREFIXES.model,
  'kayam:provider:': STORAGE_PREFIXES.provider,
  'kayam:context-panel-open:': STORAGE_PREFIXES.contextPanelOpen,
};

export function migrateLegacyStorageKeys(): void {
  try {
    const moves: Array<[string, string]> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const directTarget = LEGACY_KEY_MAP[key];
      if (directTarget) {
        moves.push([key, directTarget]);
        continue;
      }
      for (const [oldPrefix, newPrefix] of Object.entries(LEGACY_PREFIX_MAP)) {
        if (key.startsWith(oldPrefix)) {
          moves.push([key, `${newPrefix}${key.slice(oldPrefix.length)}`]);
          break;
        }
      }
    }
    for (const [oldKey, newKey] of moves) {
      if (localStorage.getItem(newKey) !== null) {
        localStorage.removeItem(oldKey);
        continue;
      }
      const value = localStorage.getItem(oldKey);
      if (value !== null) {
        localStorage.setItem(newKey, value);
        localStorage.removeItem(oldKey);
      }
    }
  } catch {
    // localStorage might be unavailable (private mode, quota); fail open.
  }
}
