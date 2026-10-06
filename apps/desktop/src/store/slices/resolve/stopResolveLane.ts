import { listResolveAttempts } from '@goodboy/db';
import type { AgentId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { laneHolderOf, laneQueueOf } from './resolveLane';
import type { GetFn, SessionParams } from './types';

type Params = SessionParams & {
  readonly get: GetFn;
  readonly worktreePath: string;
};

export const stopResolveLane = async ({ get, sessionId, worktreePath }: Params): Promise<void> => {
  const attempts = await listResolveAttempts({ db: tauriDatabase, sessionId });
  const agents = get().sessionPhaseRuns[sessionId] ?? [];
  const holder = laneHolderOf({ attempts, agents, worktreePath });
  const agentIds = new Set<AgentId>([
    ...laneQueueOf({ attempts, worktreePath }).map((attempt) => attempt.agentId),
    ...(holder === null ? [] : [holder.agentId]),
  ]);
  for (const agentId of agentIds) {
    await get().forceCloseResolver(sessionId, agentId);
  }
};
