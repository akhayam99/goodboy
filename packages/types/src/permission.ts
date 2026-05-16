import type {
  IsoDateTime,
  PermissionRequestId,
  PermissionRuleId,
  ProviderRunId,
  SessionId,
  WorkspaceId,
} from './ids';

export type ClaudePermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'dontAsk'
  | 'plan';

export type PermissionRuleScope = 'workspace' | 'session' | 'global';

export type PermissionDecisionKind = 'allow' | 'deny' | 'ask';

export interface PermissionRulePattern {
  readonly tool: string;
  readonly argsMatcher?: string;
}

export interface PermissionRule {
  readonly id: PermissionRuleId;
  readonly scope: PermissionRuleScope;
  readonly workspaceId?: WorkspaceId;
  readonly sessionId?: SessionId;
  readonly pattern: PermissionRulePattern;
  readonly decision: PermissionDecisionKind;
  readonly priority: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface PermissionRequest {
  readonly id: PermissionRequestId;
  readonly runId: ProviderRunId;
  readonly toolUseId: string;
  readonly toolName: string;
  readonly input: unknown;
  readonly at: IsoDateTime;
}

export type PermissionDecisionOutcome = 'allow' | 'deny';

export type PermissionDecisionSource = 'user' | 'rule' | 'default';

export interface PermissionDecision {
  readonly requestId: PermissionRequestId;
  readonly decision: PermissionDecisionOutcome;
  readonly ruleId: PermissionRuleId | null;
  readonly decidedBy: PermissionDecisionSource;
  readonly at: IsoDateTime;
}

export interface PermissionAuditEntry {
  readonly request: PermissionRequest;
  readonly decision: PermissionDecision;
}
