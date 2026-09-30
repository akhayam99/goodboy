import type { AgentId } from '@goodboy/types';
import { cancelTurn } from '../../../features/chat/turn';
import { cancelledRunIds } from '../sessions/sessionMutators';
import { awaitRunStopped } from './awaitRunStopped';
import { cancelTurnStartWindow } from '../turn/turnStartWindow';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly agentId: AgentId;
};

export const stopAgentForDelete = async ({ get, agentId }: Params): Promise<boolean> => {
  const turn = get().agentTurnState[agentId];
  if (turn?.kind === 'starting') {
    cancelTurnStartWindow({ agentId });
    return true;
  }
  if (turn?.kind !== 'running') {
    return true;
  }
  cancelledRunIds.add(turn.runId);
  await cancelTurn(turn.runId).catch(() => undefined);
  return awaitRunStopped({ runId: turn.runId }).catch(() => false);
};
