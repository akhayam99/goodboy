import type { WorkspaceId } from '@kay-am/types';

export const SETTING_EDITOR_BINARY = 'editor.binary';
export const SETTING_LAST_WORKSPACE_ID = 'last.workspace_id';
export const SETTING_LAST_SESSION_ID = 'last.session_id';
export const SETTING_PROVIDER_PRICING_CONFIG = 'provider.pricing_config';
export const DEFAULT_EDITOR_BINARY = 'code';
export const DEFAULT_BRANCH_PREFIX = 'kay';

export const settingBranchPrefix = (workspaceId: WorkspaceId): string =>
  `workspace.${workspaceId}.branch_prefix`;
