import type {
  PermissionDecision,
  PermissionDecisionOutcome,
  PermissionRequest,
  PermissionRule,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { compiledToolMatcher, formatToolPattern } from './matcher';
import { SCOPE_RANK, isApplicable } from './shared';

export type PermissionEngineDeps = {
  readonly defaultDecision?: 'allow' | 'deny';
};

type DecideParams = {
  readonly request: PermissionRequest;
  readonly rules: ReadonlyArray<PermissionRule>;
  readonly context: { readonly sessionId: SessionId; readonly workspaceId: WorkspaceId };
};

type RuleParams = {
  readonly rule: PermissionRule;
};

const specificity = ({ rule }: RuleParams): number =>
  formatToolPattern({ pattern: rule.pattern }).includes('*') ? 0 : 1;

const denyRank = ({ rule }: RuleParams): number =>
  rule.decision === 'deny' || rule.decision === 'ask' ? 1 : 0;

const compareRules = (a: PermissionRule, b: PermissionRule): number => {
  if (b.priority !== a.priority) {
    return b.priority - a.priority;
  }
  const scopeDiff = SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope];
  if (scopeDiff !== 0) {
    return scopeDiff;
  }
  const specificityDiff = specificity({ rule: b }) - specificity({ rule: a });
  if (specificityDiff !== 0) {
    return specificityDiff;
  }
  return denyRank({ rule: b }) - denyRank({ rule: a });
};

export class PermissionEngine {
  private readonly defaultDecision: 'allow' | 'deny';

  constructor(deps?: PermissionEngineDeps) {
    this.defaultDecision = deps?.defaultDecision ?? 'deny';
  }

  decide({ request, rules, context }: DecideParams): PermissionDecision {
    const matched = rules.filter(
      (rule) =>
        isApplicable(rule, context) &&
        compiledToolMatcher({ pattern: rule.pattern }).matches({
          toolName: request.toolName,
          input: request.input,
        }),
    );
    const winner = [...matched].sort(compareRules)[0];
    if (winner === undefined) {
      return {
        requestId: request.id,
        decision: this.defaultDecision,
        ruleId: null,
        decidedBy: 'default',
        at: request.at,
      };
    }
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
