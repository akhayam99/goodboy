import type { IsoDateTime, PermissionRuleId, ProviderRunId, TurnEvent } from '@kay-am/types';

export function createPermissionRequestEvent(params: {
  readonly runId: ProviderRunId;
  readonly toolUseId: string;
  readonly toolName: string;
  readonly input: unknown;
  readonly at: IsoDateTime;
}): Extract<TurnEvent, { kind: 'permission_request' }> {
  return {
    kind: 'permission_request',
    runId: params.runId,
    toolUseId: params.toolUseId,
    toolName: params.toolName,
    input: params.input,
    at: params.at,
  };
}

export function createPermissionDecisionEvent(params: {
  readonly runId: ProviderRunId;
  readonly toolUseId: string;
  readonly decision: 'allow' | 'deny';
  readonly ruleId: PermissionRuleId | null;
  readonly decidedBy: 'engine' | 'user' | 'default';
  readonly at: IsoDateTime;
}): Extract<TurnEvent, { kind: 'permission_decision' }> {
  return {
    kind: 'permission_decision',
    runId: params.runId,
    toolUseId: params.toolUseId,
    decision: params.decision,
    ruleId: params.ruleId,
    decidedBy: params.decidedBy,
    at: params.at,
  };
}
