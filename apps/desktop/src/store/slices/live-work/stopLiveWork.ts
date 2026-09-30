import type { ProviderRunId } from '@goodboy/types';
import { cancelTurn } from '../../../features/chat/turn';
import type { GetFn } from '../../slice-types';
import { cancelTurnStartWindow } from '../turn/turnStartWindow';
import { selectLiveWork } from './selectLiveWork';

type Params = {
  readonly get: GetFn;
};

export const stopLiveWork = async ({ get }: Params): Promise<void> => {
  const state = get();
  const live = selectLiveWork({ state });
  const runIds = new Set<ProviderRunId>();
  for (const session of state.sessions) {
    if (session.state.kind === 'running') {
      runIds.add(session.state.runId);
    }
  }
  for (const agentId of [...live.runningAgentIds, ...live.blockedAgentIds]) {
    const turnState = state.agentTurnState[agentId];
    if (turnState?.kind === 'starting') {
      cancelTurnStartWindow({ agentId });
      continue;
    }
    if (turnState?.kind === 'running' || turnState?.kind === 'blocked') {
      runIds.add(turnState.runId);
    }
  }
  await Promise.all([
    ...[...runIds].map((runId) => cancelTurn(runId).catch(() => undefined)),
    ...live.decidingRuns.map(({ sessionId, workflowRunId }) =>
      state.stopWorkflowRunNow(sessionId, workflowRunId),
    ),
  ]);
};
