import type { PermissionRule, PermissionRuleScope, TaskId, WorkspaceId } from '@kay-am/types';
import { formatToolPattern } from './matcher';

export interface ClaudeFlagSet {
  readonly allowedTools: ReadonlyArray<string>;
  readonly disallowedTools: ReadonlyArray<string>;
  readonly permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'dontAsk' | 'plan';
}

const SCOPE_RANK: Record<PermissionRuleScope, number> = {
  task: 2,
  workspace: 1,
  global: 0,
};

function isApplicable(
  rule: PermissionRule,
  scope: { workspaceId: WorkspaceId; taskId: TaskId },
): boolean {
  if (rule.scope === 'global') return true;
  if (rule.scope === 'task') return rule.taskId === scope.taskId;
  if (rule.scope === 'workspace') return rule.workspaceId === scope.workspaceId;
  return false;
}

export function buildClaudeFlags(input: {
  readonly rules: ReadonlyArray<PermissionRule>;
  readonly scope: { workspaceId: WorkspaceId; taskId: TaskId };
}): ClaudeFlagSet {
  const applicable = input.rules.filter((r) => isApplicable(r, input.scope));

  const sorted = [...applicable].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope];
  });

  const allowedSet = new Set<string>();
  const disallowedSet = new Set<string>();
  const allowedTools: string[] = [];
  const disallowedTools: string[] = [];

  for (const rule of sorted) {
    if (rule.decision === 'ask') continue;
    const rendered = formatToolPattern(rule.pattern);
    if (rule.decision === 'allow') {
      if (!allowedSet.has(rendered)) {
        allowedSet.add(rendered);
        allowedTools.push(rendered);
      }
    } else {
      if (!disallowedSet.has(rendered)) {
        disallowedSet.add(rendered);
        disallowedTools.push(rendered);
      }
    }
  }

  return { allowedTools, disallowedTools, permissionMode: 'default' };
}
