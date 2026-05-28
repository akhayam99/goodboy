/**
 * Max workspaces a user can keep connected at once.
 * Beta-phase cap: keeps disk/worktree footprint predictable and forces
 * users to disconnect stale repos rather than hoarding them.
 */
export const MAX_WORKSPACES = 3;

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
