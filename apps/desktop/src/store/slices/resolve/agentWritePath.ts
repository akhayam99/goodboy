import { listResolveAttempts } from '@goodboy/db';
import type { AgentId, ResolveAttemptPhase, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const HOLDING_PHASES: ReadonlyArray<ResolveAttemptPhase> = ['queued', 'running', 'waiting'];

export const agentDestinationPath = ({
  get,
  agentId,
}: Omit<Params, 'sessionId'>): string | null => {
  const destination = get().agentTurnDestination?.[agentId] ?? null;
  return destination !== null && destination.kind === 'mount' ? destination.worktreePath : null;
};

export const agentWritePaths = async ({
  get,
  sessionId,
  agentId,
}: Params): Promise<ReadonlyArray<string>> => {
  const attempts = await listResolveAttempts({ db: tauriDatabase, sessionId }).catch(() => []);
  const held = attempts.flatMap((attempt) => {
    if (attempt.agentId !== agentId || !HOLDING_PHASES.includes(attempt.phase)) {
      return [];
    }
    const path = attempt.mountTarget?.worktreePath ?? null;
    return path === null ? [] : [path];
  });
  const destination = agentDestinationPath({ get, agentId });
  return [...new Set<string>([...held, ...(destination === null ? [] : [destination])])];
};
