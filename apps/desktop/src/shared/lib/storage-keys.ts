const PREFIX = 'goodboy:';

export const STORAGE_KEYS = {
  theme: `${PREFIX}theme`,
  pricingSortKey: `${PREFIX}pricing-sort-key`,
  diffLayoutMode: `${PREFIX}diff-layout-mode`,
  diffWrap: `${PREFIX}diff-wrap`,
  sessionSidebarCollapsed: `${PREFIX}sessions-sidebar-collapsed`,
  leftSidebarWidth: `${PREFIX}left-sidebar-width:v2`,
  changelogCache: `${PREFIX}changelog-cache:v1`,
} as const;

export const STORAGE_PREFIXES = {
  diffReviewed: `${PREFIX}diff-reviewed:`,
  sessionView: `${PREFIX}session-view:`,
  sessionFilters: `${PREFIX}session-filters:`,
  cursorMaxMode: `${PREFIX}cursor-max-mode:`,
  inboxKindFilter: `${PREFIX}inbox-kind-filter:`,
  artifactDrafts: `${PREFIX}artifact-drafts:`,
  workflowBuilderMode: `${PREFIX}workflow-builder-mode:`,
  kickoffStartChoice: `${PREFIX}kickoff-start-choice:`,
  boardCollapsed: `${PREFIX}board-collapsed:v1:`,
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
