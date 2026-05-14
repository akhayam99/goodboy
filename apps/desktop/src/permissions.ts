import { invoke } from '@tauri-apps/api/core';
import type {
  IsoDateTime,
  PermissionAuditEntry,
  PermissionDecisionKind,
  PermissionDecisionOutcome,
  PermissionDecisionSource,
  PermissionRule,
  PermissionRuleId,
  PermissionRuleScope,
  PermissionRequestId,
  ProviderRunId,
  TaskId,
  WorkspaceId,
} from '@kay-am/types';

interface RawPermissionRuleRow {
  readonly id: string;
  readonly scope: string;
  readonly workspaceId: string | null;
  readonly taskId: string | null;
  readonly patternTool: string;
  readonly patternArgsMatcher: string | null;
  readonly decision: string;
  readonly priority: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface RawPermissionAuditRow {
  readonly id: string;
  readonly runId: string;
  readonly taskId: string;
  readonly toolUseId: string;
  readonly toolName: string;
  readonly inputJson: string;
  readonly decision: string;
  readonly ruleId: string | null;
  readonly decidedBy: string;
  readonly requestedAt: string;
  readonly decidedAt: string;
}

function rowToPermissionRule(row: RawPermissionRuleRow): PermissionRule {
  return {
    id: row.id as PermissionRuleId,
    scope: row.scope as PermissionRuleScope,
    ...(row.workspaceId != null && { workspaceId: row.workspaceId as WorkspaceId }),
    ...(row.taskId != null && { taskId: row.taskId as TaskId }),
    pattern: {
      tool: row.patternTool,
      ...(row.patternArgsMatcher != null && { argsMatcher: row.patternArgsMatcher }),
    },
    decision: row.decision as PermissionDecisionKind,
    priority: row.priority,
    createdAt: row.createdAt as IsoDateTime,
    updatedAt: row.updatedAt as IsoDateTime,
  };
}

function rowToAuditEntry(row: RawPermissionAuditRow): PermissionAuditEntry {
  return {
    request: {
      id: row.id as PermissionRequestId,
      runId: row.runId as ProviderRunId,
      toolUseId: row.toolUseId,
      toolName: row.toolName,
      input: JSON.parse(row.inputJson) as unknown,
      at: row.requestedAt as IsoDateTime,
    },
    decision: {
      requestId: row.id as PermissionRequestId,
      decision: row.decision as PermissionDecisionOutcome,
      ruleId: row.ruleId != null ? (row.ruleId as PermissionRuleId) : null,
      decidedBy: row.decidedBy as PermissionDecisionSource,
      at: row.decidedAt as IsoDateTime,
    },
  };
}

export interface PermissionRuleUpsertPayload {
  readonly id?: PermissionRuleId;
  readonly scope: PermissionRuleScope;
  readonly workspaceId?: WorkspaceId;
  readonly taskId?: TaskId;
  readonly patternTool: string;
  readonly patternArgsMatcher?: string;
  readonly decision: PermissionDecisionKind;
  readonly priority: number;
}

export interface PermissionAuditInsertPayload {
  readonly id?: string;
  readonly runId: ProviderRunId;
  readonly taskId: TaskId;
  readonly toolUseId: string;
  readonly toolName: string;
  readonly inputJson: string;
  readonly decision: PermissionDecisionOutcome;
  readonly ruleId?: PermissionRuleId;
  readonly decidedBy: PermissionDecisionSource;
  readonly requestedAt: IsoDateTime;
  readonly decidedAt: IsoDateTime;
}

// Permission rule commands (#176).
export async function invokePermissionRuleList(args: {
  scope: PermissionRuleScope;
  workspaceId?: WorkspaceId;
  taskId?: TaskId;
}): Promise<ReadonlyArray<PermissionRule>> {
  const rows = await invoke<RawPermissionRuleRow[]>('permission_rule_list', {
    scope: args.scope,
    workspaceId: args.workspaceId ?? null,
    taskId: args.taskId ?? null,
  });
  return rows.map(rowToPermissionRule);
}

export async function invokePermissionRuleUpsert(
  input: PermissionRuleUpsertPayload,
): Promise<PermissionRule> {
  const row = await invoke<RawPermissionRuleRow>('permission_rule_upsert', {
    input: {
      id: input.id ?? null,
      scope: input.scope,
      workspaceId: input.workspaceId ?? null,
      taskId: input.taskId ?? null,
      patternTool: input.patternTool,
      patternArgsMatcher: input.patternArgsMatcher ?? null,
      decision: input.decision,
      priority: input.priority,
    },
  });
  return rowToPermissionRule(row);
}

// Permission audit commands (#177).
export async function invokePermissionAuditInsert(
  input: PermissionAuditInsertPayload,
): Promise<PermissionAuditEntry> {
  const row = await invoke<RawPermissionAuditRow>('permission_audit_insert', {
    input: {
      id: input.id ?? null,
      runId: input.runId,
      taskId: input.taskId,
      toolUseId: input.toolUseId,
      toolName: input.toolName,
      inputJson: input.inputJson,
      decision: input.decision,
      ruleId: input.ruleId ?? null,
      decidedBy: input.decidedBy,
      requestedAt: input.requestedAt,
      decidedAt: input.decidedAt,
    },
  });
  return rowToAuditEntry(row);
}

// Permission audit retry queue (#196).

interface RawAuditRetryRow {
  readonly id: string;
  readonly payloadJson: string;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface AuditRetryEntry {
  readonly id: string;
  readonly payloadJson: string;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

function rowToAuditRetryEntry(row: RawAuditRetryRow): AuditRetryEntry {
  return {
    id: row.id,
    payloadJson: row.payloadJson,
    attempts: row.attempts,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function invokeAuditRetryEnqueue(id: string, payloadJson: string): Promise<void> {
  return invoke<void>('permission_audit_retry_enqueue', { input: { id, payloadJson } });
}

export async function invokeAuditRetryDrain(
  limit: number,
): Promise<ReadonlyArray<AuditRetryEntry>> {
  const rows = await invoke<RawAuditRetryRow[]>('permission_audit_retry_drain', { limit });
  return rows.map(rowToAuditRetryEntry);
}

export async function invokeAuditRetryUpdate(
  id: string,
  attempts: number,
  lastError: string,
): Promise<void> {
  return invoke<void>('permission_audit_retry_update', { id, attempts, lastError });
}

export async function invokeAuditRetryDelete(id: string): Promise<void> {
  return invoke<void>('permission_audit_retry_delete', { id });
}
