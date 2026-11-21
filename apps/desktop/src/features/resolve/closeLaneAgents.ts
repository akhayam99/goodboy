import type { AgentId, ResolveAttempt, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { laneHolderOf, laneQueueOf } from '../../store/slices/resolve/resolveLane';

type Params = {
  readonly get: () => Pick<AppStore, 'sessionPhaseRuns' | 'forceCloseResolver'>;
  readonly sessionId: SessionId;
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly worktreePath: string;
};

export const closeLaneAgents = async ({
  get,
  sessionId,
  attempts,
  worktreePath,
}: Params): Promise<ReadonlyArray<AgentId>> => {
  const agents = get().sessionPhaseRuns[sessionId] ?? [];
  const holder = laneHolderOf({ attempts, agents, worktreePath });
  const queued = laneQueueOf({ attempts, worktreePath }).map((attempt) => attempt.agentId);
  const holderIds = holder === null ? [] : [holder.agentId];
  const closed = new Set<AgentId>();
  for (const agentId of new Set<AgentId>([...queued, ...holderIds])) {
    if ((await get().forceCloseResolver(sessionId, agentId)) === 'closed') {
      closed.add(agentId);
    }
  }
  return [...new Set<AgentId>([...holderIds, ...queued])].filter((agentId) => closed.has(agentId));
};
