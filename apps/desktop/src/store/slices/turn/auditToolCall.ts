import { PermissionEngine } from '@goodboy/core';
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
import type { GetFn, SetFn } from './types';

type Params = {
  event: Extract<TurnEvent, { kind: 'tool_call_start' }>;
  runId: ProviderRunId;
  sessionId: SessionId;
  workspaceId: WorkspaceId;
  effectiveRules: ReadonlyArray<PermissionRule>;
};

export const auditToolCall = async (
  set: SetFn,
  get: GetFn,
  { event, runId, sessionId, workspaceId, effectiveRules }: Params,
): Promise<void> => {
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
  const volatile = get().volatilePermissionAllows;
  const isVolatileAllow = volatile.has(event.toolUseId);
  if (isVolatileAllow) {
    set((state) => {
      const next = new Set(state.volatilePermissionAllows);
      next.delete(event.toolUseId);
      return { volatilePermissionAllows: next };
    });
  }
  const decision: PermissionDecision = isVolatileAllow
    ? {
        requestId: auditRequestId,
        decision: 'allow',
        ruleId: null,
        decidedBy: 'user',
        at: event.at,
      }
    : engine.decide(request, effectiveRules, {
        sessionId,
        workspaceId,
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
