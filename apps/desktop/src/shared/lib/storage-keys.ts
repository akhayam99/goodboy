const PREFIX = 'goodboy:';

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
  agentVerbosity: `${PREFIX}agent-verbosity:`,
  agentEffort: `${PREFIX}agent-effort:`,
  agentModel: `${PREFIX}agent-model:`,
  agentProvider: `${PREFIX}agent-provider:`,
  diffView: `${PREFIX}diff-view:`,
} as const;
