import { listResolveAttempts } from '@goodboy/db';
import type { AgentId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { AppStore } from '../../store';
import { closeLaneAgents } from '../../../features/resolve/closeLaneAgents';
import type { SessionParams } from './types';

type Params = SessionParams & {
  readonly get: () => Pick<AppStore, 'sessionPhaseRuns' | 'forceCloseResolver'>;
  readonly worktreePath: string;
};

export const stopResolveLane = async ({
  get,
  sessionId,
  worktreePath,
}: Params): Promise<ReadonlyArray<AgentId>> => {
  const attempts = await listResolveAttempts({ db: tauriDatabase, sessionId });
  return closeLaneAgents({ get, sessionId, attempts, worktreePath });
};
