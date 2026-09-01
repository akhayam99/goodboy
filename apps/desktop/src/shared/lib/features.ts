export const WORKSPACE_FEATURES = {
  workflows: true,
  skills: false,
  permissions: true,
} as const;

export const SESSION_FEATURES = {
  budget: true,
  sessionArchival: true,
  branchSwitching: true,
  verbosity: true,
} as const;
