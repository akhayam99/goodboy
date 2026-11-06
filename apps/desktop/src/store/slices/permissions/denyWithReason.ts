import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import { throwIfRefused } from '../turn/refusal/throwIfRefused';
import { denialNoticeOf } from './denialNoticeOf';
import type { GetFn } from './types';

type Params = {
  sessionId: SessionId;
  agentId: AgentId;
  toolUseId: string;
  toolName: string;
  runId: ProviderRunId;
  reason: string;
};

export const denyWithReason = (get: GetFn) => {
  return async ({
    sessionId,
    agentId,
    toolUseId,
    toolName,
    runId,
    reason,
  }: Params): Promise<void> => {
    const now = brandId<IsoDateTime>({ value: new Date().toISOString() });
    const trimmed = reason.trim();
    get().appendTurnEvent(agentId, sessionId, {
      kind: 'permission_decision',
      runId,
      toolUseId,
      decision: 'deny',
      scope: 'once',
      ruleId: null,
      decidedBy: 'user',
      ...(trimmed !== '' && { reason: trimmed }),
      at: now,
    });
    if (get().agentTurnState[agentId]?.kind === 'running') {
      return;
    }
    throwIfRefused({
      result: await get().sendTurn({
        sessionId,
        agentId,
        content: denialNoticeOf({ toolName, reason: trimmed }),
      }),
    });
  };
};
