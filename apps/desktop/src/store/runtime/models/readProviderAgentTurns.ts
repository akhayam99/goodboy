import { ROOM_TURNS_WINDOW_MS } from '@goodboy/core/providers';
import { listProviderAgentTurns, type ProviderAgentTurns } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';

const NO_TURNS: ReadonlyArray<ProviderAgentTurns> = [];

type Params = {
  readonly nowMs: number;
};

export const readProviderAgentTurns = async ({
  nowMs,
}: Params): Promise<ReadonlyArray<ProviderAgentTurns>> => {
  try {
    return await listProviderAgentTurns({
      db: tauriDatabase,
      sinceMs: nowMs - ROOM_TURNS_WINDOW_MS,
    });
  } catch (error) {
    console.warn(`[routing] provider turns read failed: ${formatError(error)}`);
    return NO_TURNS;
  }
};
