export const CORE_FEATURES = {
  workspaces: true,
  sessions: true,
  chat: true,
  providers: true,
  models: true,
} as const;

export const WORKSPACE_FEATURES = {
  workflows: true,
  skills: false,
  contextPanel: true,
  permissions: true,
  initScript: true,
} as const;

export const SESSION_FEATURES = {
  budget: false,
  sessionArchival: true,
  branchSwitching: true,
  verbosity: true,
} as const;

export const AGENT_FEATURES = {
  parallelAgents: false,
  maxParallelism: 4,
} as const;

export const UX_FEATURES = {
  darkMode: true,
  commandPalette: true,
  shortcutsHelp: true,
  guide: true,
  notifications: true,
  nextActions: true,
} as const;

export const INTEGRATION_FEATURES = {
  githubIntegration: true,
} as const;

export const DATA_FEATURES = {
  exportImport: true,
  costTracking: true,
  diffViewer: true,
  mergeDialogs: true,
} as const;
