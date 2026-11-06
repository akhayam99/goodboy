import { revertAgentStart, updateProviderRunStatus, updateSessionState } from '@goodboy/db';
import type { Agent, AgentId, ProviderRunId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { invokeAgentList } from '../../../../features/workflows/workflows';
import { tauriDatabase } from '../../../../shared/lib/db';
import { nowIso } from '../../project-mounts/nowIso';
import { cancelledRunIds } from '../../sessions/sessionMutators';
import type { GetFn, SetFn } from '../types';
import { releaseUnstartedTurn } from './releaseUnstartedTurn';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  sessionId: SessionId;
  agentId: AgentId;
  resolvedAgentId: AgentId | null;
  agentBefore: Agent | null;
  runId: ProviderRunId;
  error: unknown;
}>;

export const closeUnspawnedRun = async ({
  set,
  get,
  sessionId,
  agentId,
  resolvedAgentId,
  agentBefore,
  runId,
  error,
}: Params): Promise<void> => {
  const wasCancelled = cancelledRunIds.delete(runId);
  const derived = releaseUnstartedTurn({ set, get, sessionId, agentId, runId });
  const at = nowIso({});
  if (derived !== null) {
    await updateSessionState(tauriDatabase, sessionId, derived, at);
  }
  await updateProviderRunStatus(
    tauriDatabase,
    runId,
    wasCancelled
      ? { kind: 'cancelled', finishedAt: at }
      : { kind: 'failed', finishedAt: at, error: formatError(error) },
  );
  if (resolvedAgentId !== null) {
    await revertAgentStart({ db: tauriDatabase, agentId: resolvedAgentId, runId, agentBefore });
  }
  const refreshedRuns = await invokeAgentList(sessionId);
  set((state) => {
    const { [runId]: _forgotten, ...routes } = state.runRouting[agentId] ?? {};
    return {
      sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
      agentRunHistory: {
        ...state.agentRunHistory,
        [agentId]: (state.agentRunHistory[agentId] ?? []).filter((id) => id !== runId),
      },
      runRouting: { ...state.runRouting, [agentId]: routes },
    };
  });
};
