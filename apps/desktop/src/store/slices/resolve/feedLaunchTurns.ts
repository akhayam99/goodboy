import { listResolveAttempts } from '@goodboy/db';
import type { AgentId, ResolveAttempt, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { dropLaunchTurns, hasLaunchTurns, takeLaunchTurn } from './launchTurns';
import { launchKeyOf } from './resolveLaunch';
import { throwIfRefused } from '../turn/refusal/throwIfRefused';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly attempt: ResolveAttempt;
};

const SETTLED_PHASES: ReadonlyArray<ResolveAttempt['phase']> = ['waiting', 'finished'];

const isRunLive = async ({
  get,
  sessionId,
  agentId,
}: {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
}): Promise<boolean> => {
  const agent = (get().sessionPhaseRuns[sessionId] ?? []).find((item) => item.id === agentId);
  if (agent === undefined || agent.doneAt != null || agent.status === 'skipped') {
    return false;
  }
  const latest = (await listResolveAttempts({ db: tauriDatabase, sessionId }))
    .filter((item) => item.agentId === agentId)
    .at(-1);
  return latest !== undefined && SETTLED_PHASES.includes(latest.phase);
};

export const feedLaunchTurns = async ({ get, sessionId, attempt }: Params): Promise<void> => {
  const launchId = launchKeyOf({ attempt });
  const stop = (): void => {
    dropLaunchTurns({ launchId });
    void get().drainResolveQueue({ sessionId });
  };
  while (hasLaunchTurns({ launchId })) {
    if (!(await isRunLive({ get, sessionId, agentId: attempt.agentId }))) {
      stop();
      return;
    }
    const turn = takeLaunchTurn({ launchId });
    if (turn === null) {
      return;
    }
    try {
      throwIfRefused({
        result: await get().sendTurn({
          sessionId,
          agentId: attempt.agentId,
          content: turn.content,
          resolveThreadIds: turn.threadIds,
        }),
      });
    } catch (error) {
      void get().reportError({ title: "Couldn't continue the fix run", error, sessionId });
      stop();
      return;
    }
  }
};
