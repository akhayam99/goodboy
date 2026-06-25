import type {
  IsoDateTime,
  PermissionRequestId,
  PermissionRuleId,
  ProviderRunId,
  SessionId,
  WorkspaceId,
} from './ids'

export type ClaudePermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'dontAsk'
  | 'plan'

export type PermissionRuleScope = 'workspace' | 'session' | 'global'

export type PermissionDecisionKind = 'allow' | 'deny' | 'ask'

export type PermissionRulePattern = {
  readonly tool: string
  readonly argsMatcher?: string
}

export type PermissionRule = {
  readonly id: PermissionRuleId
  readonly scope: PermissionRuleScope
  readonly workspaceId?: WorkspaceId
  readonly sessionId?: SessionId
  readonly pattern: PermissionRulePattern
  readonly decision: PermissionDecisionKind
  readonly priority: number
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

export type PermissionRequest = {
  readonly id: PermissionRequestId
  readonly runId: ProviderRunId
  readonly toolUseId: string
  readonly toolName: string
  readonly input: unknown
  readonly at: IsoDateTime
}

export type PermissionDecisionOutcome = 'allow' | 'deny'

export type PermissionDecisionSource = 'user' | 'rule' | 'default'

export type PermissionDecision = {
  readonly requestId: PermissionRequestId
  readonly decision: PermissionDecisionOutcome
  readonly ruleId: PermissionRuleId | null
  readonly decidedBy: PermissionDecisionSource
  readonly at: IsoDateTime
}

export type PermissionAuditEntry = {
  readonly request: PermissionRequest
  readonly decision: PermissionDecision
}
