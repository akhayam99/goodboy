const PREFIX = 'goodboy:';

// Only device-local UI state remains in localStorage. Domain state
// (archived sessions, model/provider/effort/verbosity overrides, onboarding
// progress) lives on the DB so it survives reinstalls. See
// shared/lib/ls-to-db-migration.ts for the one-shot legacy-key sweep.
export const STORAGE_KEYS = {
  theme: `${PREFIX}theme`,
  pricingSortKey: `${PREFIX}pricing-sort-key`,
  diffSidebarCollapsed: `${PREFIX}diff-sidebar-collapsed`,
} as const;

export const STORAGE_PREFIXES = {
  contextPanelOpen: `${PREFIX}context-panel-open:`,
  diffView: `${PREFIX}diff-view:`,
  sessionView: `${PREFIX}session-view:`,
} as const;

export const wipeLocalStorage = (): void => {
  if (typeof localStorage === 'undefined') return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
};
