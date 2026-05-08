import type { WorkspaceId } from '@kay-am/types';

export const SETTING_EDITOR_BINARY = 'editor.binary';
export const SETTING_DEFAULT_EDITOR = 'editor.default';
export const SETTING_LAST_WORKSPACE_ID = 'last.workspace_id';
export const SETTING_LAST_SESSION_ID = 'last.session_id';
export const SETTING_ENABLE_PARALLEL_AGENTS = 'experimental.enable_parallel_agents';
export const SETTING_MAX_PARALLELISM = 'experimental.max_parallelism';
export const DEFAULT_EDITOR_BINARY = 'code';
export const DEFAULT_BRANCH_PREFIX = 'kay';
export const DEFAULT_ENABLE_PARALLEL_AGENTS = false;
export const DEFAULT_MAX_PARALLELISM = 4;
export const MIN_PARALLELISM = 1;
export const MAX_PARALLELISM = 8;

export const settingBranchPrefix = (workspaceId: WorkspaceId): string =>
  `workspace.${workspaceId}.branch_prefix`;
