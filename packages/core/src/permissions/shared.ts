import type { PermissionRule, PermissionRuleScope, SessionId, WorkspaceId } from '@goodboy/types';

export const SCOPE_RANK: Record<PermissionRuleScope, number> = {
  session: 2,
  workspace: 1,
  global: 0,
};

export const isApplicable = (
  rule: PermissionRule,
  context: { sessionId: SessionId; workspaceId: WorkspaceId },
): boolean => {
  if (rule.scope === 'global') {
    return true;
  }
  if (rule.scope === 'session') {
    return rule.sessionId === context.sessionId;
  }
  if (rule.scope === 'workspace') {
    return rule.workspaceId === context.workspaceId;
  }
  return false;
};
