import type {
  PermissionDecision,
  PermissionDecisionOutcome,
  PermissionRequest,
  PermissionRule,
  PermissionRuleScope,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { formatToolPattern, parseToolPattern } from './matcher';

export interface PermissionEngineDeps {
  readonly defaultDecision?: 'allow' | 'deny';
}

const SCOPE_RANK: Record<PermissionRuleScope, number> = {
  session: 2,
  workspace: 1,
  global: 0,
};

function isApplicable(
  rule: PermissionRule,
  context: { sessionId: SessionId; workspaceId: WorkspaceId },
): boolean {
  if (rule.scope === 'global') return true;
  if (rule.scope === 'session') return rule.sessionId === context.sessionId;
  if (rule.scope === 'workspace') return rule.workspaceId === context.workspaceId;
  return false;
}

function isSpecific(rule: PermissionRule): boolean {
  const pattern = formatToolPattern(rule.pattern);
  return !pattern.includes('*');
}

export class PermissionEngine {
  private readonly defaultDecision: 'allow' | 'deny';

  constructor(deps?: PermissionEngineDeps) {
    this.defaultDecision = deps?.defaultDecision ?? 'deny';
  }

  decide(
    request: PermissionRequest,
    rules: ReadonlyArray<PermissionRule>,
    context: { sessionId: SessionId; workspaceId: WorkspaceId },
  ): PermissionDecision {
    const applicable = rules.filter((r) => isApplicable(r, context));

    const matched = applicable.filter((r) => {
      const matcher = parseToolPattern(formatToolPattern(r.pattern));
      return matcher.matches(request.toolName, request.input);
    });

    if (matched.length === 0) {
      return {
        requestId: request.id,
        decision: this.defaultDecision,
        ruleId: null,
        decidedBy: 'default',
        at: request.at,
      };
    }

    // Sort: priority desc, scope desc, specificity desc, deny-wins on ties
    const sorted = [...matched].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const scopeDiff = SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope];
      if (scopeDiff !== 0) return scopeDiff;
      const aSpec = isSpecific(a) ? 1 : 0;
      const bSpec = isSpecific(b) ? 1 : 0;
      if (bSpec !== aSpec) return bSpec - aSpec;
      // equal precedence: deny/ask wins over allow
      const denyRank = (d: string) => (d === 'deny' || d === 'ask' ? 1 : 0);
      return denyRank(b.decision) - denyRank(a.decision);
    });

    // sorted is guaranteed non-empty (matched.length > 0)
    const winner = sorted[0] as PermissionRule;
    const outcome: PermissionDecisionOutcome = winner.decision === 'allow' ? 'allow' : 'deny';

    return {
      requestId: request.id,
      decision: outcome,
      ruleId: winner.id,
      decidedBy: 'rule',
      at: request.at,
    };
  }
}
