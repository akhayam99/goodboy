const PREFIX = 'goodboy:';

export const STORAGE_KEYS = {
  theme: `${PREFIX}theme`,
  pricingSortKey: `${PREFIX}pricing-sort-key`,
  diffSidebarCollapsed: `${PREFIX}diff-sidebar-collapsed`,
  sessionsSidebarCollapsed: `${PREFIX}sessions-sidebar-collapsed`,
  lensColumnWidth: `${PREFIX}lens-column-width`,
  inspectorPanelWidth: `${PREFIX}inspector-panel-width`,
  reviewBoardListWidth: `${PREFIX}review-board-list-width`,
  planListWidth: `${PREFIX}plan-list-width`,
  workflowStudioRailWidth: `${PREFIX}workflow-studio-rail-width`,
  leftSidebarWidth: `${PREFIX}left-sidebar-width:v2`,
  rightSidebarWidth: `${PREFIX}right-sidebar-width`,
} as const;

export const STORAGE_PREFIXES = {
  workSurfaceView: `${PREFIX}work-surface-view:`,
  diffView: `${PREFIX}diff-view:`,
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
