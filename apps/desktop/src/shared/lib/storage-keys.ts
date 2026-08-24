const PREFIX = 'goodboy:';

export const STORAGE_KEYS = {
  theme: `${PREFIX}theme`,
  pricingSortKey: `${PREFIX}pricing-sort-key`,
  diffSidebarCollapsed: `${PREFIX}diff-sidebar-collapsed`,
  diffLayoutMode: `${PREFIX}diff-layout-mode`,
  sessionSidebarCollapsed: `${PREFIX}sessions-sidebar-collapsed`,
  inspectorPanelWidth: `${PREFIX}inspector-panel-width`,
  reviewBoardListWidth: `${PREFIX}review-board-list-width`,
  leftSidebarWidth: `${PREFIX}left-sidebar-width:v2`,
  rightSidebarWidth: `${PREFIX}right-sidebar-width`,
  changelogCache: `${PREFIX}changelog-cache:v1`,
} as const;

export const STORAGE_PREFIXES = {
  workSurfaceView: `${PREFIX}work-surface-view:`,
  diffReviewed: `${PREFIX}diff-reviewed:`,
  sessionView: `${PREFIX}session-view:`,
  cursorMaxMode: `${PREFIX}cursor-max-mode:`,
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
