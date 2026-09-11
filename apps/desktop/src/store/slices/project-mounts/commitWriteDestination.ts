import { updateSessionWriteDestination } from '@goodboy/db';
import type { SessionId, SessionProjectMount } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { writeDestinationPatch } from './writeDestinationPatch';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly mount: SessionProjectMount | null;
};

export const commitWriteDestination = async ({
  set,
  sessionId,
  mount,
}: Params): Promise<boolean> => {
  const written = await updateSessionWriteDestination({
    db: tauriDatabase,
    sessionId,
    mountId: mount?.mountId ?? null,
  }).catch(() => false);
  if (!written) {
    return false;
  }
  set((state) => writeDestinationPatch({ state, sessionId, mount }));
  return true;
};
