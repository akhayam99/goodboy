const PREFIX = 'goodboy:';

// Only device-local UI state remains in localStorage. Domain state
// (archived sessions, model/provider/effort/verbosity overrides, onboarding
// progress) lives on the DB so it survives reinstalls. See
// shared/lib/ls-to-db-migration.ts for the one-shot legacy-key sweep.
export const STORAGE_KEYS = {
  theme: `${PREFIX}theme`,
  pricingSortKey: `${PREFIX}pricing-sort-key`,
  diffSidebarCollapsed: `${PREFIX}diff-sidebar-collapsed`,
  composerLiveMarkdown: `${PREFIX}composer-live-markdown`,
} as const;

export const STORAGE_PREFIXES = {
  contextPanelOpen: `${PREFIX}context-panel-open:`,
  diffView: `${PREFIX}diff-view:`,
  sessionView: `${PREFIX}session-view:`,
} as const;
