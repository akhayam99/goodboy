import type { AgentId, ProviderRunId, SessionId } from '@goodboy/types';
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
    await get().resolvePermissionRequest({
      sessionId,
      agentId,
      toolUseId,
      toolName,
      runId,
      scope: 'deny',
    });
    const trimmed = reason.trim();
    if (trimmed === '') {
      return;
    }
    if (get().agentTurnState[agentId]?.kind === 'running') {
      return;
    }
    await get().sendTurn({ sessionId, agentId, content: `Denied ${toolName}. ${trimmed}` });
  };
};
