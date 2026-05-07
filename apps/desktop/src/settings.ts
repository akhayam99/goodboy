import type { WorkspaceId } from '@kay-am/types';

export const SETTING_EDITOR_BINARY = 'editor.binary';
export const DEFAULT_EDITOR_BINARY = 'code';
export const DEFAULT_BRANCH_PREFIX = 'kay';

export const settingBranchPrefix = (workspaceId: WorkspaceId): string =>
  `workspace.${workspaceId}.branch_prefix`;
