import type { AgentId, ProviderRunId, SessionId, TurnState } from '@goodboy/types';
import { nowIso } from '../../project-mounts/nowIso';
import { applyAgentTurnState } from '../../sessions/sessionMutators';
import type { GetFn, SetFn } from '../types';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  sessionId: SessionId;
  agentId: AgentId;
  runId?: ProviderRunId;
}>;

export const releaseUnstartedTurn = ({
  set,
  get,
  sessionId,
  agentId,
  runId,
}: Params): TurnState | null => {
  const current = get().agentTurnState[agentId];
  const isOwnRun = current?.kind === 'running' && runId !== undefined && current.runId === runId;
  if (current?.kind !== 'starting' && !isOwnRun) {
    return null;
  }
  const at = nowIso({});
  return applyAgentTurnState(set, sessionId, agentId, { kind: 'idle', lastActivityAt: at }, at);
};
