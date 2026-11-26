import { PermissionEngine } from '@goodboy/core/permissions';
import type {
  PermissionDecision,
  PermissionRequest,
  PermissionRequestId,
  PermissionRule,
  ProviderRunId,
  SessionId,
  TurnEvent,
  WorkspaceId,
} from '@goodboy/types';
import type { PermissionAuditInsertPayload } from '../../../features/permissions/permissions';
import { persistPermissionAudit } from './persistPermissionAudit';

type Params = {
  event: Extract<TurnEvent, { kind: 'tool_call_start' }>;
  runId: ProviderRunId;
  sessionId: SessionId;
  workspaceId: WorkspaceId;
  effectiveRules: ReadonlyArray<PermissionRule>;
};

export const auditToolCall = async ({
  event,
  runId,
  sessionId,
  workspaceId,
  effectiveRules,
}: Params): Promise<void> => {
  const engine = new PermissionEngine();
  const auditRequestId = crypto.randomUUID() as PermissionRequestId;
  const request: PermissionRequest = {
    id: auditRequestId,
    runId,
    toolUseId: event.toolUseId,
    toolName: event.toolName,
    input: event.input,
    at: event.at,
  };
  const decision: PermissionDecision = engine.decide({
    request,
    rules: effectiveRules,
    context: { sessionId, workspaceId },
  });
  const auditPayload: PermissionAuditInsertPayload = {
    id: auditRequestId,
    runId,
    sessionId,
    toolUseId: event.toolUseId,
    toolName: event.toolName,
    inputJson: JSON.stringify(event.input),
    decision: decision.decision,
    ...(decision.ruleId != null && { ruleId: decision.ruleId }),
    decidedBy: decision.decidedBy,
    requestedAt: event.at,
    decidedAt: decision.at,
  };
  await persistPermissionAudit({ payload: auditPayload });
};
