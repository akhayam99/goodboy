import { updateSessionWriteDestination } from '@goodboy/db';
import type { SessionId, SessionProjectMount } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { writeDestinationPatch } from './writeDestinationPatch';
import type { SetFn } from './types';

export type PreviousWriteDestination = 'held' | 'released';

type Params = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly mount: SessionProjectMount | null;
  readonly previousSelection: PreviousWriteDestination;
};

export const commitWriteDestination = async ({
  set,
  sessionId,
  mount,
  previousSelection,
}: Params): Promise<boolean> => {
  const written = await updateSessionWriteDestination({
    db: tauriDatabase,
    sessionId,
    mountId: mount?.mountId ?? null,
  }).catch(() => false);
  if (written) {
    set((state) => writeDestinationPatch({ state, sessionId, mount }));
    return true;
  }
  if (previousSelection === 'released') {
    set((state) => writeDestinationPatch({ state, sessionId, mount: null }));
  }
  return false;
};
