import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import { throwIfRefused } from '../turn/refusal/throwIfRefused';
import { askBatchAfterAnswer } from './askBatchAfterAnswer';
import { askDenialEventOf } from './askDenialEventOf';
import { denialNoticeOf } from './denialNoticeOf';
import { heldOnceAllowsOf } from './heldOnceAllowsOf';
import { NO_RESOLVED_ASKS } from './noResolvedAsks';
import type { GetFn } from './types';
import { withHeldAnswers } from './withHeldAnswers';

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
    get().appendTurnEvent(
      agentId,
      sessionId,
      askDenialEventOf({ runId, toolUseId, reason: trimmed, at: now }),
    );
    if (get().agentTurnState[agentId]?.kind === 'running') {
      return;
    }
    const { isWaiting, held } = askBatchAfterAnswer({
      transcripts: get().transcripts,
      agentId,
      toolUseId,
    });
    if (isWaiting) {
      return;
    }
    const prompt = denialNoticeOf({ toolName, reason: trimmed });
    throwIfRefused({
      result: await get().sendTurn({
        sessionId,
        agentId,
        content: withHeldAnswers({ held, prompt }),
        resolvedAsks: NO_RESOLVED_ASKS,
        ...(held.length > 0 && { permissionOnceAllows: heldOnceAllowsOf({ held }) }),
      }),
    });
  };
};
