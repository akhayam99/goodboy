export const WORKSPACE_FEATURES = {
  workflows: true,
  skills: false,
  contextPanel: true,
  permissions: true,
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
