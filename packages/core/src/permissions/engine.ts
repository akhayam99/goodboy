import type {
  PermissionDecision,
  PermissionDecisionOutcome,
  PermissionRequest,
  PermissionRule,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { formatToolPattern, parseToolPattern } from './matcher';
import { SCOPE_RANK, isApplicable } from './shared';

export type PermissionEngineDeps = {
  readonly defaultDecision?: 'allow' | 'deny';
};

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

    const sorted = [...matched].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      const scopeDiff = SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope];
      if (scopeDiff !== 0) {
        return scopeDiff;
      }
      const aSpec = isSpecific(a) ? 1 : 0;
      const bSpec = isSpecific(b) ? 1 : 0;
      if (bSpec !== aSpec) {
        return bSpec - aSpec;
      }
      const denyRank = (d: string) => (d === 'deny' || d === 'ask' ? 1 : 0);
      return denyRank(b.decision) - denyRank(a.decision);
    });

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
