import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import type { GetFn } from './types';

type Params = {
  sessionId: SessionId;
  agentId: AgentId;
  toolUseId: string;
  toolName: string;
  runId: ProviderRunId;
  reason: string;
};

type NoticeParams = {
  readonly toolName: string;
  readonly reason: string;
};

const noticeOf = ({ toolName, reason }: NoticeParams): string =>
  reason === ''
    ? `Denied ${toolName} for this one call. Do not run it; carry on another way, or say what you need.`
    : `Denied ${toolName}. ${reason}`;

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
    get().appendTurnEvent(agentId, sessionId, {
      kind: 'permission_decision',
      runId,
      toolUseId,
      decision: 'deny',
      scope: 'once',
      ruleId: null,
      decidedBy: 'user',
      at: now,
    });
    if (get().agentTurnState[agentId]?.kind === 'running') {
      return;
    }
    await get().sendTurn({
      sessionId,
      agentId,
      content: noticeOf({ toolName, reason: reason.trim() }),
    });
  };
};
