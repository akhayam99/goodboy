import type {
  AgentId,
  IsoDateTime,
  PermissionDecisionOutcome,
  PermissionRuleId,
  PermissionRequestId,
  ProviderRunId,
  SessionId,
} from '@goodboy/types';
import { persistPermissionAudit } from '../turn/persistPermissionAudit';
import { askedCallOf } from './askedCallOf';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
  readonly toolUseId: string;
  readonly toolName: string;
  readonly decision: PermissionDecisionOutcome;
  readonly ruleId: PermissionRuleId | null;
  readonly decidedAt: IsoDateTime;
};

export const recordPermissionDecision = async ({
  get,
  sessionId,
  agentId,
  runId,
  toolUseId,
  toolName,
  decision,
  ruleId,
  decidedAt,
}: Params): Promise<void> => {
  const asked = askedCallOf({ events: get().transcripts[agentId] ?? [], toolUseId });
  await persistPermissionAudit({
    payload: {
      id: crypto.randomUUID() as PermissionRequestId,
      runId,
      sessionId,
      toolUseId,
      toolName,
      inputJson: JSON.stringify(asked?.input ?? {}),
      decision,
      ...(ruleId !== null && { ruleId }),
      decidedBy: 'user',
      requestedAt: asked?.at ?? decidedAt,
      decidedAt,
    },
  });
};
