import { listTurnFileSets } from '@goodboy/db';
import type { SessionId, TurnFileSet } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';

type Params = {
  readonly sessionId: SessionId;
};

export const loadTurnFileSets = ({ sessionId }: Params): Promise<ReadonlyArray<TurnFileSet>> =>
  listTurnFileSets({ db: tauriDatabase, sessionId });
