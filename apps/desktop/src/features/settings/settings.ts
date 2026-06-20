import type { WorkspaceId } from '@goodboy/types';

export const SETTING_EDITOR_BINARY = 'editor.binary';
export const SETTING_DEFAULT_EDITOR = 'editor.default';
export const SETTING_LAST_WORKSPACE_ID = 'last.workspace_id';
export const SETTING_LAST_SESSION_ID = 'last.session_id';
export const SETTING_REOPEN_LAST = 'launch.reopen_last';
export const DEFAULT_EDITOR_BINARY = 'code';
export const DEFAULT_BRANCH_PREFIX = 'goodboy';

export const settingBranchPrefix = (workspaceId: WorkspaceId): string =>
  `workspace.${workspaceId}.branch_prefix`;
