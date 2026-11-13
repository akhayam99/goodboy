import type { SessionId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';
import { loadFullAgentRows } from './loadFullAgentRows';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

type LightParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

const MAX_ATTEMPTS = 3;

const isLight = ({ get, sessionId }: LightParams): boolean =>
  (get().lightAgentSessions ?? {})[sessionId] === true;

export const ensureFullAgents = async ({ set, get, sessionId }: Params): Promise<void> => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (!isLight({ get, sessionId })) {
      return;
    }
    await loadFullAgentRows({ set, get, sessionId, isWanted: () => true });
  }
  if (isLight({ get, sessionId })) {
    throw new Error("Couldn't load this session's agents");
  }
};
