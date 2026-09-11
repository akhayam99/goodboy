import { listResolveAttempts } from '@goodboy/db';
import type { AgentId, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const agentWritePath = async ({
  get,
  sessionId,
  agentId,
}: Params): Promise<string | null> => {
  const attempts = await listResolveAttempts({ db: tauriDatabase, sessionId }).catch(() => []);
  const held = attempts.find(
    (attempt) =>
      attempt.agentId === agentId &&
      (attempt.phase === 'queued' || attempt.phase === 'running' || attempt.phase === 'waiting'),
  );
  const attemptPath = held?.mountTarget?.worktreePath ?? null;
  if (attemptPath !== null) {
    return attemptPath;
  }
  const destination = get().agentTurnDestination?.[agentId] ?? null;
  return destination !== null && destination.kind === 'mount' ? destination.worktreePath : null;
};
